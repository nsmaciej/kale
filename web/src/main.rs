#![allow(unused_imports)]

use std::collections::HashMap;
use std::fmt;

use euclid::*;
use itertools::Itertools;
use log::*;
use stdweb::js;
use stdweb::unstable::{TryFrom, TryInto};
use stdweb::web::{alert, document, Element, IElement, INode};
use web_logger;

use Expr::*;

type SvgPoint = default::Point2D<f32>;
type SvgRect = default::Rect<f32>;
type SvgSize = default::Size2D<f32>;

#[derive(Debug, Clone)]
enum Expr {
    Call { name: String, arguments: Vec<Expr> },
    Lit { kind: String, content: String },
    Var { name: String },
    Do { expressions: Vec<Expr> },
}

#[derive(Debug)]
struct ExprRendering {
    elements: Vec<Element>,
    size: SvgSize,
}

struct RenderingState {
    text_metrics_cache: HashMap<String, f32>,
    measurement_text_element: Element,
}

const FONT: &str = "16px Helvetica";

macro_rules! attrs {
    ($element:expr; $($name:expr => $value:expr,)*) => {
        $($element.set_attribute($name, $value).unwrap();)*
    };
}

macro_rules! svg {
    ($tag:expr; $($name:expr => $value:expr,)*) => {{
        const SVG_NS: &str = "http://www.w3.org/2000/svg";
        let node = document().create_element_ns(SVG_NS, $tag).unwrap();
        $(node.set_attribute($name, $value).unwrap();)*
        node
    }};
}

impl RenderingState {
    fn new() -> RenderingState {
        let svg = svg! { "svg";
            // It has to be visibility instead of display none. Not really sure why.
            "style" => "visibility: hidden; position: absolute;",
            "width" => "200",
            "height" => "200",
            "viewBox" => "0 0 200 200",
        };
        let text = new_text(SvgPoint::zero(), "");
        svg.append_child(&text);
        document().body().unwrap().append_child(&svg);
        RenderingState {
            text_metrics_cache: HashMap::new(),
            measurement_text_element: text,
        }
    }

    /// Measure text by using a hidden svg element's text metrics methods.
    fn measure_text(&mut self, text: &str) -> SvgSize {
        if let Some(width) = self.text_metrics_cache.get(text) {
            size2(*width, 20.)
        } else {
            self.measurement_text_element.set_text_content(text);
            let width = js! { return @{&self.measurement_text_element}.getComputedTextLength(); };
            // Stdweb doesn't do f32s.
            let width = f64::try_from(width).unwrap() as f32;
            self.text_metrics_cache.insert(text.to_string(), width);
            //TODO: Get the height.
            size2(width, 20.)
        }
    }
}

impl ExprRendering {
    fn group(self) -> Element {
        let group = svg! { "g"; };
        for e in self.elements {
            group.append_child(&e);
        }
        group
    }

    fn translate(self, point: SvgPoint) -> Self {
        let size = self.size;
        let group = self.group();
        group
            .set_attribute("transform", &format!("translate({} {})", point.x, point.y))
            .unwrap();
        ExprRendering {
            elements: vec![group],
            size,
        }
    }

    fn fill(self, colour: &str) -> Self {
        let size = self.size;
        let group = self.group();
        group.set_attribute("fill", colour).unwrap();
        ExprRendering {
            elements: vec![group],
            size,
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
        "style" => &format!("font: {};", FONT),
        "x" => &pt.x.to_string(),
        "y" => &pt.y.to_string(),
        "alignment-baseline" => "hanging",
    };
    text.set_text_content(contents);
    text
}

fn render_text(state: &mut RenderingState, contents: &str) -> ExprRendering {
    ExprRendering {
        elements: vec![new_text(SvgPoint::zero(), contents)],
        size: state.measure_text(contents),
    }
}

fn render(state: &mut RenderingState, expr: &Expr) -> ExprRendering {
    match expr {
        Var { name } => render_text(state, name).fill("green"),
        Lit { content, .. } => render_text(state, content).fill("red"),
        Call { name, arguments } => {
            const PADDING: f32 = 3.;
            let mut elements = Vec::with_capacity(name.len() + arguments.len());
            let mut size = state.measure_text(name);
            size.width += PADDING;
            elements.push(new_text(SvgPoint::zero(), name));
            for arg in arguments {
                let arg_rendering = render(state, arg).translate(point2(size.width, 0.));
                size.width += arg_rendering.size.width + PADDING;
                size.height = size.height.max(arg_rendering.size.height);
                elements.extend(arg_rendering.elements.into_iter());
            }
            ExprRendering { elements, size }
        }
        Do { expressions } => {
            const PADDING: f32 = 3.;
            let mut elements = Vec::with_capacity(expressions.len());
            let mut size = SvgSize::zero();
            for expr in expressions {
                let arg_rendering = render(state, expr).translate(point2(0., size.height));
                size.height += arg_rendering.size.height + PADDING;
                size.width = size.width.max(arg_rendering.size.width);
                elements.extend(arg_rendering.elements.into_iter());
            }
            ExprRendering { elements, size }
        }
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
    let render_list = render(&mut state, &fact);

    let canvas = svg! {"svg";
            "width" => "500",
            "height" => "500",
            "viewBox" => "0 0 500 500",
    };
    for elem in render_list.elements {
        canvas.append_child(&elem);
    }

    let body = document().body().unwrap();
    let greeting = document().create_element("h1").unwrap();
    greeting.set_text_content("Welcome to Kale!");
    body.append_child(&greeting);
    body.append_child(&canvas);
}
