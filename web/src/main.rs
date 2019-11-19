#![feature(vec_remove_item)]

/// KaleLisp expressions.
mod expr;
/// Rendering engine.
mod render;

use std::cell::RefCell;
use std::collections::VecDeque;
use std::rc::Rc;

use euclid::{point2, rect, size2};
use log::*;
use stdweb::js;
use stdweb::web::event::*;
use stdweb::web::{alert, document, Element, INode};
use web_logger;

use expr::*;
use render::*;

type Shared<T> = Rc<RefCell<T>>;

#[derive(Debug)]
enum Event {
    Select { id: ExprId },
}

/// Data about a particual instance of the Kale editor.
struct Editor {
    root: Element,
    frozen: bool,
    expr: Expr,
    /// Yanked expressions.
    yanked: Vec<Expr>,
    selection: Option<ExprId>,
}

struct KaleState {
    editor: RefCell<Editor>,
    rendering_state: RefCell<RenderingState>,
    event_queue: Shared<VecDeque<Event>>,
}

thread_local! {
    static KALE_STATE: Rc<KaleState> = Rc::new(KaleState::new());
}

pub(crate) fn kale() -> Rc<KaleState> {
    KALE_STATE.with(Rc::clone)
}

impl KaleState {
    fn new() -> Self {
        KaleState {
            event_queue: Rc::new(RefCell::new(VecDeque::new())),
            editor: RefCell::new(Editor::new(size2(500., 500.))),
            rendering_state: RefCell::new(RenderingState::new()),
        }
    }

    fn push_event(&self, event: Event) {
        self.event_queue.borrow_mut().push_back(event);
    }

    fn process_events(&self) {
        use Event::*;
        loop {
            let event = self.event_queue.borrow_mut().pop_front();
            if let Some(event) = event {
                let mut editor = self.editor.borrow_mut();
                match event {
                    Select { id } => editor.select(id),
                };
            } else {
                break;
            }
        }
        self.editor
            .borrow_mut()
            .render(&mut self.rendering_state.borrow_mut());
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
            selection: None,
            yanked: Vec::new(),
            expr: Do {
                id: ExprId::from_raw(0),
                expressions: Vec::new(),
            }
            .into(),
        }
    }

    //TODO: Is supporting multiple select expressions a good idea?
    fn select(&mut self, id: ExprId) {
        self.selection = Some(id);
        info!(
            "Inside the editor it's mutable and everyting! with id: {:?}",
            id
        );
    }

    fn render(&mut self, state: &mut RenderingState) {
        fn render(editor: &Editor, state: &mut RenderingState, expr: &Expr) -> ExprRendering {
            const PADDING: f32 = 3.;
            let make_click_handler = move |id: ExprId| {
                move |event: ClickEvent| {
                    event.stop_propagation();
                    kale().push_event(Event::Select { id });
                    kale().process_events();
                }
            };
            let mut rendering = match expr {
                Expr::Comment(Comment { id, text, .. }) => Text::new(text, TextStyle::Comment)
                    .colour("#43a047")
                    .render(state)
                    .event(make_click_handler(*id)),
                Expr::Var(Var { id, name, .. }) => Text::new(name, TextStyle::Mono)
                    .colour("#f44336")
                    .render(state)
                    .event(make_click_handler(*id)),
                Expr::Lit(Lit { id, content, .. }) => Text::new(content, TextStyle::Mono)
                    .colour("#283593")
                    .render(state)
                    .event(make_click_handler(*id)),
                Expr::Call(Call {
                    id,
                    name,
                    arguments,
                    ..
                }) => {
                    //TODO: Render the underlines/whatever else to help show the nesting level.
                    //TODO: The spacing between the arguments shouldn't just be a constant. For
                    // shorter expressions, or maybe certain functions the spacing should be
                    // decreased.
                    let mut rendering = Text::new(name, TextStyle::Mono)
                        .render(state)
                        .event(make_click_handler(*id));
                    rendering.size.width += PADDING;
                    for arg in arguments {
                        // Clicking the separator dot selects its argument.
                        rendering.place(
                            point2(rendering.size.width + 3., 2.),
                            Circle::new(point2(3., 3.), 3.)
                                .fill("#aaa")
                                .render(state)
                                .event(make_click_handler(arg.id())),
                        );
                        rendering.place(
                            point2(rendering.size.width + 1., 0.),
                            render(editor, state, arg),
                        );
                        rendering.size.width += PADDING;
                    }
                    rendering
                }
                Expr::Do(Do {
                    id, expressions, ..
                }) => {
                    let mut rendering = ExprRendering::empty();
                    for expr in expressions {
                        rendering.place(
                            point2(5., rendering.size.height),
                            render(editor, state, expr),
                        );
                        rendering.size.height += PADDING;
                    }
                    rendering.place(
                        SvgPoint::zero(),
                        //TODO: It would be nice for the rect to expand in some fashion when hovered
                        // about. It should not have a single-pixel wide hit box.
                        Rect::new(rect(0., 0., 1., rendering.size.height))
                            .fill("#aaa")
                            .render(state)
                            .event(make_click_handler(*id)),
                    );
                    rendering
                }
                Expr::Hole(_) => {
                    todo!("Render the hole");
                }
            };

            // Handle drawing the selection.
            if editor.selection == Some(expr.id()) {
                rendering.place(
                    SvgPoint::zero(),
                    Rect::new(rect(0., 0., rendering.size.width, rendering.size.height))
                        .stroke("#aaa")
                        .render(state),
                );
            }
            rendering
        }

        let render_list = render(self, state, &self.expr);
        js! { @{&self.root}.innerHTML = "" };
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
    let kale = kale();
    kale.editor.borrow_mut().expr = fact;
    kale.editor
        .borrow_mut()
        .render(&mut kale.rendering_state.borrow_mut());
}
