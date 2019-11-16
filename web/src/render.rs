use std::collections::HashMap;

use euclid::*;
use stdweb::web::event::*;
use stdweb::web::{alert, document, Element, EventListenerHandle, IElement, IEventTarget, INode};

//TODO: Get rid of this, used by the click() method.
use crate::expr::ExprId;

pub type Colour = &'static str;
pub type SvgPoint = default::Point2D<f32>;
pub type SvgSize = default::Size2D<f32>;
pub type SvgRect = default::Rect<f32>;

#[derive(Debug)]
pub struct ExprRendering {
    //TODO: These should not be pub once we work out the api.
    pub elements: Vec<Element>,
    pub size: SvgSize,
    event_listeners: Vec<EventListenerHandle>,
}

pub struct RenderingState {
    text_metrics_cache: HashMap<String, f32>,
    measurement_text_element: Element,
}

pub enum TextStyle {
    Mono,
    Comment,
}

/// Implemented on types which can be assigned to an html attribute.
pub trait AssignAttribute {
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

/// The attribute is not assigned if option is None.
impl<T: AssignAttribute> AssignAttribute for Option<T> {
    fn assign_attribute(&self, element: &Element, name: &str) {
        if let Some(val) = self {
            val.assign_attribute(element, name);
        }
    }
}

#[macro_export]
macro_rules! attrs {
    ($element:expr; $($name:expr => $value:expr),* $(,)?) => {{
        // Possibly move the element.
        let element = $element;
        $($value.assign_attribute(&element, $name);)*
        element
    }};
}

#[macro_export]
macro_rules! svg {
    ($tag:expr; $($name:expr => $value:expr),* $(,)?) => {{
        const SVG_NS: &str = "http://www.w3.org/2000/svg";
        let element = document().create_element_ns(SVG_NS, $tag).unwrap();
        $($value.assign_attribute(&element, $name);)*
        element
    }};
}

impl RenderingState {
    pub fn new() -> RenderingState {
        let svg = svg! { "svg";
            // It has to be visibility instead of display none. Not really sure why.
            "style" => "visibility: hidden; position: absolute;",
            "width" => "1",
            "height" => "1",
            "viewBox" => "0 0 1 1",
        };
        //TODO: Work with different text styles.
        let text = Text::new("", TextStyle::Mono).element();
        svg.append_child(&text);
        document().body().unwrap().append_child(&svg);
        RenderingState {
            text_metrics_cache: HashMap::new(),
            measurement_text_element: text,
        }
    }

    /// Measure text by using a hidden svg element's text metrics methods.
    fn measure_text(&mut self, text: &str) -> SvgSize {
        use stdweb::{js, unstable::TryFrom};
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
    pub fn empty() -> Self {
        ExprRendering {
            elements: Vec::new(),
            size: SvgSize::zero(),
            event_listeners: Vec::new(),
        }
    }

    pub fn group(&self) -> Element {
        let group = svg! { "g"; };
        for e in &self.elements {
            group.append_child(e);
        }
        group
    }

    pub fn click(mut self, id: ExprId) -> Self {
        for elem in &self.elements {
            let handle = elem.add_event_listener(move |_e: ClickEvent| {
                alert(&format!("Clicked {:?}", id));
            });
            self.event_listeners.push(handle);
        }
        self
    }

    pub fn translate(self, point: SvgPoint) -> Self {
        ExprRendering {
            elements: vec![attrs! { self.group();
                "transform" => format!("translate({} {})", point.x, point.y),
            }],
            ..self
        }
    }

    pub fn place(&mut self, point: SvgPoint, rendering: ExprRendering) {
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

pub trait Renderable {
    fn element(&self) -> Element;
    fn size(&self, state: &mut RenderingState) -> SvgSize;

    fn render(&self, state: &mut RenderingState) -> ExprRendering {
        ExprRendering {
            elements: vec![self.element()],
            size: self.size(state),
            event_listeners: Vec::new(),
        }
    }
}

pub struct Rect {
    rect: SvgRect,
    fill: Option<Colour>,
    stroke: Option<Colour>,
}

pub struct Circle {
    origin: SvgPoint,
    radius: f32,
    fill: Option<Colour>,
    stroke: Option<Colour>,
}

pub struct Text<'a> {
    origin: SvgPoint,
    content: &'a str,
    style: TextStyle,
    colour: Colour,
}

macro_rules! setter {
    ($($field:ident: $type:ty),*) => {
        $(
            #[allow(dead_code)]
            pub fn $field(mut self, $field: $type) -> Self {
                self.$field = $field.into();
                self
            }
        )*
    };
}

impl Circle {
    setter!(fill: Colour, stroke: Colour);
    pub fn new(origin: SvgPoint, radius: f32) -> Self {
        Circle {
            origin,
            radius,
            fill: None,
            stroke: None,
        }
    }
}

impl Rect {
    setter!(fill: Colour, stroke: Colour);
    pub fn new(rect: SvgRect) -> Self {
        Rect {
            rect,
            fill: None,
            stroke: None,
        }
    }
}

impl<'a> Text<'a> {
    setter!(origin: SvgPoint, colour: Colour);
    pub fn new(content: &'a str, style: TextStyle) -> Self {
        Text {
            origin: SvgPoint::zero(),
            colour: "#000",
            content,
            style,
        }
    }
}

impl Renderable for Circle {
    fn element(&self) -> Element {
        svg! {"circle";
            "cx" => self.origin.x,
            "cy" => self.origin.y,
            "r" => self.radius,
            "fill" => self.fill.unwrap_or("transparent"),
            "stroke" => self.stroke.unwrap_or("transparent"),
        }
    }

    fn size(&self, _: &mut RenderingState) -> SvgSize {
        size2(self.radius * 2., self.radius * 2.)
    }
}

impl Renderable for Rect {
    fn element(&self) -> Element {
        let SvgRect { origin, size } = self.rect;
        svg! {"rect";
            "x" => origin.x,
            "y" => origin.y,
            "width" => size.width,
            "height" => size.height,
            "fill" => self.fill.unwrap_or("transparent"),
            "stroke" => self.stroke.unwrap_or("transparent"),
        }
    }

    fn size(&self, _: &mut RenderingState) -> SvgSize {
        self.rect.size
    }
}

impl Renderable for Text<'_> {
    fn element(&self) -> Element {
        let text = svg! { "text";
            "style" => format!("font: {};", match self.style {
                TextStyle::Mono => "16px Input Sans",
                TextStyle::Comment => "italic 16px Helvetica Neue",
            }),
            "x" => self.origin.x,
            "y" => self.origin.y,
            "fill" => self.colour,
            "alignment-baseline" => "hanging",
        };
        text.set_text_content(self.content);
        text
    }

    fn size(&self, state: &mut RenderingState) -> SvgSize {
        state.measure_text(self.content)
    }
}
