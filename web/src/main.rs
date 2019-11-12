use std::collections::HashMap;
use std::fmt;

use euclid::*;
use itertools::Itertools;
use log::*;
use stdweb::js;
use stdweb::unstable::{TryFrom, TryInto};
use stdweb::web::{alert, document, Element, IElement, INode, Node};
use web_logger;

use Expr::*;

type SvgPoint = default::Point2D<f32>;

#[derive(Debug, Clone)]
enum Expr {
    Call { name: String, arguments: Vec<Expr> },
    Lit { kind: String, content: String },
    Var { name: String },
    Do { expressions: Vec<Expr> },
}

struct RenderingState {
    text_metrics_cache: HashMap<String, f32>,
    measurement_text_element: Element,
}

const FONT: &str = "20px Helvetica";

macro_rules! svg {
    ($tag:expr; $($name:ident = $value:expr,)*) => {{
        const SVG_NS: &str = "http://www.w3.org/2000/svg";
        let node = document().create_element_ns(SVG_NS, $tag).unwrap();
        $(node.set_attribute(stringify!($name), $value).unwrap();)*
        node
    }};
}

impl RenderingState {
    fn new() -> RenderingState {
        let svg = svg! { "svg";
            // It has to be visibility instead of display none. Not really sure why.
            style = "visibility: hidden; position: absolute;",
            width = "200",
            height = "200",
            viewBox = "0 0 200 200",
        };
        let text = new_text(point2(0., 0.), "");
        svg.append_child(&text);
        document().body().unwrap().append_child(&svg);
        RenderingState {
            text_metrics_cache: HashMap::new(),
            measurement_text_element: text,
        }
    }

    /// Measure text by using a hidden svg element's text metrics methods.
    fn measure_text(&mut self, text: &str) -> f32 {
        if let Some(width) = self.text_metrics_cache.get(text) {
            *width
        } else {
            self.measurement_text_element.set_text_content(text);
            let width = js! { return @{&self.measurement_text_element}.getComputedTextLength(); };
            // Stdweb doesn't do f32s.
            let width = f64::try_from(width).unwrap() as f32;
            self.text_metrics_cache.insert(text.to_string(), width);
            width
        }
    }
}

impl fmt::Display for Expr {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Call { name, arguments } => write!(f, "{}({})", name, arguments.iter().format(", ")),
            Lit { kind, content } => write!(f, "{}:{}", content, kind),
            Var { name } => write!(f, "{}", name),
            Do { expressions } => write!(f, "{{{}}}", expressions.iter().format(", ")),
        }
    }
}

macro_rules! expr {
    ($val:tt => $kind:ident) => {
        Expr::Lit {
            content: stringify!($val).to_string(),
            kind: stringify!($kind).to_string(),
        }
    };
    (block $([$($tok:tt)+])*) => {
        Expr::Do {
            expressions: vec![$(expr!($($tok)*),)*],
        }
    };
    ($name:tt($([$($tok:tt)+])*)) => {
        Expr::Call {
            name: stringify!($name).to_string(),
            arguments: vec![$(expr!($($tok)*),)*],
        }
    };
    ($var:tt) => {
        Expr::Var { name: stringify!($var).to_string() }
    };
}

/// Create a new svg text element with a hanging baseline.
fn new_text(pt: SvgPoint, contents: &str) -> Element {
    let text = svg! { "text";
        style = &format!("font: {}", FONT),
        x = &format!("{}", pt.x),
        y = &format!("{}", pt.y),
    };
    // Sadly Rust doesn't support minus in identifiers, so we can't do this using the macro.
    text.set_attribute("alignment-baseline", "hagning").unwrap();
    text.set_text_content(contents);
    text
}

fn render(state: &mut RenderingState, expr: &Expr) -> Vec<Element> {
    match expr {
        Var { name } => vec![new_text(point2(20., 20.), name)],
        _ => Vec::new(),
    }
}

fn main() {
    // Example KaleLisp function.
    let fact = expr! {
        if([=([n] [0 => int])]
           [1 => int]
           [block [print([n])]
                  [*([n]
                     [fact([-([n]
                              [1 => int])])])]])
    };

    web_logger::init();
    info!("{}", fact);
    let mut state = RenderingState::new();
    let render_list = render(&mut state, &expr! { x });

    let canvas = svg! {"svg";
            width = "200",
            height = "200",
            viewBox = "0 0 200 200",
    };
    for elem in render_list {
        canvas.append_child(&elem);
    }

    let body = document().body().unwrap();
    let greeting = document().create_element("h1").unwrap();
    greeting.set_text_content("Welcome to Kale!");
    body.append_child(&greeting);
    body.append_child(&canvas);
}
