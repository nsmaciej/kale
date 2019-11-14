#![allow(unused_imports)]

mod expr;

use std::collections::HashMap;

use euclid::*;
use log::*;
use stdweb::unstable::{TryFrom, TryInto};
use stdweb::web::{alert, document, Element, IElement, INode};
use stdweb::{console, js};
use web_logger;

use expr::*;

type SvgPoint = default::Point2D<f32>;
type SvgSize = default::Size2D<f32>;
type SvgRect = default::Rect<f32>;

#[derive(Debug)]
struct ExprRendering {
    elements: Vec<Element>,
    size: SvgSize,
}

struct RenderingState {
    text_metrics_cache: HashMap<String, f32>,
    measurement_text_element: Element,
}

enum TextStyle {
    Mono,
    Comment,
}

/// Data about a particual instance of the Kale editor.
struct Editor {
    root: Element,
    frozen: bool,
    expr: Expr,
    selection: Vec<ExprId>,
}

const DEBUG: bool = false;

macro_rules! attrs {
    ($element:expr; $($name:expr => $value:expr,)*) => {{
        // Possibly move the element.
        let element = $element;
        $(element.set_attribute($name, $value).unwrap();)*
        element
    }};
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
            "width" => "1",
            "height" => "1",
            "viewBox" => "0 0 1 1",
        };
        //TODO: Work with different text styles.
        let text = new_text(SvgPoint::zero(), "", TextStyle::Mono);
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
    fn empty() -> Self {
        ExprRendering {
            elements: vec![],
            size: SvgSize::zero(),
        }
    }

    fn group(self) -> Element {
        let group = svg! { "g"; };
        if DEBUG {
            group.append_child(&svg! { "rect";
                "width" => &self.size.width.to_string(),
                "height" => &self.size.height.to_string(),
                "fill" => "none",
                "stroke" => "#ddd",
            });
        }
        for e in self.elements {
            group.append_child(&e);
        }
        group
    }

    fn translate(self, point: SvgPoint) -> Self {
        ExprRendering {
            size: self.size,
            elements: vec![attrs! { self.group();
                "transform" => &format!("translate({} {})", point.x, point.y),
            }],
        }
    }

    fn fill(self, colour: &str) -> Self {
        ExprRendering {
            size: self.size,
            elements: vec![attrs! { self.group();
                "fill" => colour,
            }],
        }
    }

    fn place(&mut self, point: SvgPoint, rendering: ExprRendering) {
        let mut rendering = rendering.translate(point);
        self.elements.append(&mut rendering.elements);
        self.size = self.size.max(rendering.size + size2(point.x, point.y));
    }
}

/// Create a new svg text element with a hanging baseline.
fn new_text(pt: SvgPoint, contents: &str, text_style: TextStyle) -> Element {
    let text = svg! { "text";
        "style" => &format!("font: {};", match text_style {
            TextStyle::Mono => "16px Input Sans",
            TextStyle::Comment => "italic 16px Helvetica Neue",
        }),
        "x" => &pt.x.to_string(),
        "y" => &pt.y.to_string(),
        "alignment-baseline" => "hanging",
    };
    text.set_text_content(contents);
    text
}

fn render_text(state: &mut RenderingState, contents: &str, text_style: TextStyle) -> ExprRendering {
    ExprRendering {
        elements: vec![new_text(SvgPoint::zero(), contents, text_style)],
        size: state.measure_text(contents),
    }
}

fn render_rect(rect: SvgRect) -> ExprRendering {
    ExprRendering {
        elements: vec![svg! {"rect";
            "x" => &rect.origin.x.to_string(),
            "y" => &rect.origin.y.to_string(),
            "width" => &rect.size.width.to_string(),
            "height" => &rect.size.height.to_string(),
            "fill" => "#aaa",
        }],
        size: rect.size,
    }
}

fn render_circle(origin: SvgPoint, r: f32) -> ExprRendering {
    ExprRendering {
        elements: vec![svg! {"circle";
            "cx" => &origin.x.to_string(),
            "cy" => &origin.y.to_string(),
            "r" => &r.to_string(),
            "fill" => "#aaa",
        }],
        size: size2(r * 2., r * 2.),
    }
}

impl Editor {
    fn new(size: SvgSize) -> Editor {
        let root = svg! {"svg";
                "width" => &size.width.to_string(),
                "height" => &size.height.to_string(),
                "viewBox" => &format!("0 0 {} {}", size.width, size.height),
        };
        let body = document().body().unwrap();
        body.append_child(&root);
        Editor {
            root,
            frozen: false,
            selection: vec![],
            expr: Do {
                id: ExprId::from_raw(0),
                expressions: Vec::new(),
            },
        }
    }

    fn render(&mut self, state: &mut RenderingState) {
        fn render(state: &mut RenderingState, expr: &Expr) -> ExprRendering {
            const PADDING: f32 = 3.;
            match expr {
                Comment { text, .. } => {
                    render_text(state, text, TextStyle::Comment).fill("#43a047")
                }
                Var { name, .. } => render_text(state, name, TextStyle::Mono).fill("#f44336"),
                Lit { content, .. } => render_text(state, content, TextStyle::Mono).fill("#283593"),
                Call {
                    name, arguments, ..
                } => {
                    //TODO: Render the underlines/whatever else to help show the nesting level.
                    //TODO: The spacing between the arguments shouldn't just be a constant. For
                    // shorter expressions, or maybe certain functions the spacing should be
                    // decreased.
                    let mut rendering = render_text(state, name, TextStyle::Mono);
                    rendering.size.width += PADDING;
                    for arg in arguments {
                        rendering.place(
                            point2(rendering.size.width + 3., 2.),
                            render_circle(point2(3., 3.), 3.),
                        );
                        rendering.place(point2(rendering.size.width + 1., 0.), render(state, arg));
                        rendering.size.width += PADDING;
                    }
                    rendering
                }
                Do { expressions, .. } => {
                    let mut rendering = ExprRendering::empty();
                    for expr in expressions {
                        rendering.place(point2(5., rendering.size.height), render(state, expr));
                        rendering.size.height += PADDING;
                    }
                    rendering.place(
                        SvgPoint::zero(),
                        render_rect(rect(0., 0., 1., rendering.size.height)),
                    );
                    rendering
                }
            }
        }

        let render_list = render(state, &self.expr);
        for elem in render_list.elements {
            self.root.append_child(&elem);
        }
    }
}

fn main() {
    // Example KaleLisp function.
    let fact = expr! {
        block [comment "This is a test program"]
              [if([=([n] [0 => int])]
                  [1 => int]
                  [block [comment "Now print out n"]
                         [print([n])]
                         [*([n]
                            [fact([-([n]
                                     [1 => int])])])]])]
    };

    web_logger::init();

    // Greet the user.
    let body = document().body().unwrap();
    let greeting = document().create_element("h1").unwrap();
    greeting.set_text_content("Welcome to Kale!");
    body.append_child(&greeting);

    // Render the editor.
    let mut state = RenderingState::new();
    let mut editor = Editor::new(size2(500., 500.));
    editor.expr = fact;
    editor.render(&mut state);
}
