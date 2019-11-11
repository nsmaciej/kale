use itertools::Itertools;
use log::*;
use std::collections::HashMap;
use std::fmt;
use stdweb::js;
use stdweb::unstable::{TryFrom, TryInto};
use stdweb::web::{alert, document, Element, IElement, INode};
use web_logger;

use Expr::*;

#[derive(Debug, Clone)]
enum Expr {
    Call { name: String, arguments: Vec<Expr> },
    Lit { kind: String, content: String },
    Var { name: String },
}

struct RenderingState {
    text_metrics_cache: HashMap<String, f32>,
    measurement_text_element: Element,
}

macro_rules! attrs {
    ($element:expr; $($name:ident => $value:expr,)*) => {
        $($element.set_attribute(stringify!($name), $value).unwrap();)*
    };
}

fn svg_element(name: &str) -> Element {
    const SVG_NS: &str = "http://www.w3.org/2000/svg";
    document().create_element_ns(SVG_NS, name).unwrap()
}

impl RenderingState {
    fn new() -> RenderingState {
        let svg = svg_element("svg");
        attrs! { svg;
            width => "200",
            height => "200",
            viewBox => "0 0 200 200",
        };
        let text = svg_element("text");
        text.set_text_content("Hello, World");
        attrs! { text; style => "font: 20pt Helvetica", x => "20", y => "20", };
        svg.append_child(&text);
        document().body().unwrap().append_child(&svg);

        RenderingState {
            text_metrics_cache: HashMap::new(),
            measurement_text_element: text,
        }
    }

    fn measure_text(&mut self, text: &str) -> f32 {
        if let Some(width) = self.text_metrics_cache.get(text) {
            *width
        } else {
            self.measurement_text_element.set_text_content(text);
            let width = js! { return @{&self.measurement_text_element}.getComputedTextLength(); };
            let width: f64 = width.try_into().unwrap();
            self.text_metrics_cache
                .insert(text.to_string(), width as f32);
            width as f32
        }
    }
}

impl fmt::Display for Expr {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Call { name, arguments } => write!(f, "{}({})", name, arguments.iter().format(",")),
            Lit { kind, content } => write!(f, "{}:{}", content, kind),
            Var { name } => write!(f, "{}", name),
        }
    }
}

macro_rules! call {
    ($name:expr, $($arg:expr),* $(,)?) => {
        Expr::Call {
            name: $name.to_string(),
            arguments: vec![$($arg)*]
        }
    };
}
macro_rules! lit {
    ($content:expr => $kind:ident) => {
        Expr::Lit {
            content: $content.to_string(),
            kind: stringify!($kind).to_string(),
        }
    };
}

fn render(expr: &Expr) {
    let mut state = RenderingState::new();
    info!("Measured text {}", state.measure_text("Hello, World"));
}

fn main() {
    web_logger::init();
    let demo = call!("print", lit!("Hello, world!" => str));
    render(&demo);

    let h1 = document().create_element("h1").unwrap();
    h1.set_text_content("Hello, World!");
    document().body().unwrap().append_child(&h1);
}
