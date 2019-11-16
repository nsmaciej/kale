#![allow(unused_imports)]

mod expr;

use std::collections::HashMap;

use euclid::*;
use log::*;
use stdweb::unstable::{TryFrom, TryInto};
use stdweb::web::event::*;
use stdweb::web::{alert, document, Element, EventListenerHandle, IElement, IEventTarget, INode};
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
    event_listeners: Vec<EventListenerHandle>,
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

trait AssignAttribute {
    fn assign_attribute(&self, element: &Element, name: &str);
}

macro_rules! impl_assign_attribute {
    ($($type:ty),*) => {
        $(
            impl AssignAttribute for $type {
                fn assign_attribute(&self, element: &Element, name: &str) {
                    element.set_attribute(name, &self.to_string()).unwrap();
                }
            }
        )*
    };
}
// Ideally we would just have two blanket impls: Option<T> and T where T: ToString. But since the
// compiler is unwilling to rule out Option implementing ToString we implement common types one by
// one.
impl_assign_attribute!(&str, String, f32, f64, u8, u16, u32, u64, i8, i16, i32, i64);

impl<T: AssignAttribute> AssignAttribute for Option<T> {
    fn assign_attribute(&self, element: &Element, name: &str) {
        if let Some(val) = self {
            val.assign_attribute(element, name);
        }
    }
}

macro_rules! attrs {
    ($element:expr; $($name:expr => $value:expr,)*) => {{
        // Possibly move the element.
        let element = $element;
        $($value.assign_attribute(&element, $name);)*
        element
    }};
}

macro_rules! svg {
    ($tag:expr; $($name:expr => $value:expr,)*) => {{
        const SVG_NS: &str = "http://www.w3.org/2000/svg";
        let element = document().create_element_ns(SVG_NS, $tag).unwrap();
        $($value.assign_attribute(&element, $name);)*
        element
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
            elements: Vec::new(),
            size: SvgSize::zero(),
            event_listeners: Vec::new(),
        }
    }

    fn group(&self) -> Element {
        let group = svg! { "g"; };
        if DEBUG {
            group.append_child(&svg! { "rect";
                "width" => self.size.width,
                "height" => self.size.height,
                "fill" => "none",
                "stroke" => "#ddd",
            });
        }
        for e in &self.elements {
            group.append_child(e);
        }
        group
    }

    fn click(mut self, id: ExprId) -> Self {
        for elem in &self.elements {
            let handle = elem.add_event_listener(move |_e: ClickEvent| {
                alert(&format!("Clicked {:?}", id));
            });
            self.event_listeners.push(handle);
        }
        self
    }

    fn translate(self, point: SvgPoint) -> Self {
        ExprRendering {
            elements: vec![attrs! { self.group();
                "transform" => format!("translate({} {})", point.x, point.y),
            }],
            ..self
        }
    }

    fn fill(self, colour: &str) -> Self {
        ExprRendering {
            elements: vec![attrs! { self.group();
                "fill" => colour,
            }],
            ..self
        }
    }

    fn place(&mut self, point: SvgPoint, rendering: ExprRendering) {
        // Must be careful here. It's easy to forget to update self, forgetting to copy something
        // from 'rendering'. We pattern match to make adding new fields a hard error.
        let ExprRendering {
            size,
            ref mut elements,
            ref mut event_listeners,
        } = rendering.translate(point);
        self.elements.append(elements);
        self.event_listeners.append(event_listeners);
        self.size = self.size.max(size + size2(point.x, point.y));
    }
}

/// Create a new svg text element with a hanging baseline.
fn new_text(pt: SvgPoint, contents: &str, text_style: TextStyle) -> Element {
    let text = svg! { "text";
        "style" => format!("font: {};", match text_style {
            TextStyle::Mono => "16px Input Sans",
            TextStyle::Comment => "italic 16px Helvetica Neue",
        }),
        "x" => pt.x,
        "y" => pt.y,
        "alignment-baseline" => "hanging",
    };
    text.set_text_content(contents);
    text
}

fn render_text(state: &mut RenderingState, contents: &str, text_style: TextStyle) -> ExprRendering {
    ExprRendering {
        elements: vec![new_text(SvgPoint::zero(), contents, text_style)],
        size: state.measure_text(contents),
        event_listeners: Vec::new(),
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
        event_listeners: Vec::new(),
    }
}

fn render_circle(origin: SvgPoint, r: f32) -> ExprRendering {
    ExprRendering {
        elements: vec![svg! {"circle";
            "cx" => origin.x,
            "cy" => origin.y,
            "r" => r,
            "fill" => "#aaa",
        }],
        size: size2(r * 2., r * 2.),
        event_listeners: Vec::new(),
    }
}

impl Editor {
    fn new(size: SvgSize) -> Editor {
        let root = svg! {"svg";
                "width" => size.width,
                "height" => size.height,
                "viewBox" => format!("0 0 {} {}", size.width, size.height),
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
                Comment { id, text, .. } => render_text(state, text, TextStyle::Comment)
                    .fill("#43a047")
                    .click(*id),
                Var { id, name, .. } => render_text(state, name, TextStyle::Mono)
                    .fill("#f44336")
                    .click(*id),
                Lit { id, content, .. } => render_text(state, content, TextStyle::Mono)
                    .fill("#283593")
                    .click(*id),
                Call {
                    id,
                    name,
                    arguments,
                    ..
                } => {
                    //TODO: Render the underlines/whatever else to help show the nesting level.
                    //TODO: The spacing between the arguments shouldn't just be a constant. For
                    // shorter expressions, or maybe certain functions the spacing should be
                    // decreased.
                    let mut rendering = render_text(state, name, TextStyle::Mono).click(*id);
                    rendering.size.width += PADDING;
                    for arg in arguments {
                        // Clicking the separator dot selects its argument.
                        rendering.place(
                            point2(rendering.size.width + 3., 2.),
                            render_circle(point2(3., 3.), 3.).click(arg.id()),
                        );
                        rendering.place(point2(rendering.size.width + 1., 0.), render(state, arg));
                        rendering.size.width += PADDING;
                    }
                    rendering
                }
                Do {
                    id, expressions, ..
                } => {
                    let mut rendering = ExprRendering::empty();
                    for expr in expressions {
                        rendering.place(point2(5., rendering.size.height), render(state, expr));
                        rendering.size.height += PADDING;
                    }
                    rendering.place(
                        SvgPoint::zero(),
                        //TODO: It would be nice for the rect to expand in some fashion when hovered
                        // about. It should not have a single-pixel wide hit box.
                        render_rect(rect(0., 0., 1., rendering.size.height)).click(*id),
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
