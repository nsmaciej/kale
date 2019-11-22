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

//TODO: Consider unifying ExprViewId and ExprId into a single structure.
#[derive(Debug)]
enum Event {
    Select { view_id: ExprViewId, id: ExprId },
    Edit { view_id: ExprViewId, id: ExprId },
}

/// A value to identify an expr view in events etc.
#[derive(Debug, Clone, PartialEq, Eq, Copy)]
enum ExprViewId {
    Main,
    Yanked { index: usize },
}

/// Data about a particual instance of the Kale editor.
struct Editor {
    root: Element,
    /// The expression the user is currently editing.
    expr: Expr,
    /// Yanked expressions.
    yanked: Vec<Expr>,
    //TODO: Track which view has the selection.
    /// The current selection in one of the editor's views.
    selection: Option<(ExprViewId, ExprId)>,
}

/// A view showing a single Kale expression.
struct ExprView<'a> {
    id: ExprViewId,
    //TODO: Something like VSCode's text decoration system would be nice.
    /// Which view should be displayed as selected.
    selection: Option<ExprId>,
    /// This expression is not editable and should be displayed appropriately.
    frozen: bool,
    /// The expression this view represents.
    expr: &'a Expr,
}

struct KaleState {
    editor: RefCell<Editor>,
    rendering_state: RefCell<RenderingState>,
    event_queue: Shared<VecDeque<Event>>,
}

thread_local! {
    static KALE_STATE: Rc<KaleState> = Rc::new(KaleState::new());
}

fn kale() -> Rc<KaleState> {
    KALE_STATE.with(Rc::clone)
}

impl KaleState {
    fn new() -> Self {
        KaleState {
            event_queue: Rc::new(RefCell::new(VecDeque::new())),
            //TODO: Obivously don't make this fixed size.
            editor: RefCell::new(Editor::new(size2(1000., 1000.))),
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
                    Select { view_id, id } => editor.selection = Some((view_id, id)),
                    Edit { view_id, id } => {
                        if view_id == ExprViewId::Main {
                            editor.edit(id, prompt(""))
                        }
                    }
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
            selection: None,
            yanked: Vec::new(),
            expr: Do {
                id: ExprId::from_raw(0),
                expressions: Vec::new(),
            }
            .into(),
        }
    }

    fn edit(&mut self, id: ExprId, text: Option<String>) {
        if let Some(text) = text {
            if let Some(expr) = self.expr.borrow_mut(id) {
                *match expr {
                    Call(x) => &mut x.function,
                    Comment(x) => &mut x.text,
                    Lit(x) => &mut x.content,
                    Var(x) => &mut x.name,
                    // We don't know how to edit this. Exit early.
                    _ => return,
                } = text;
            }
        } else {
            // Don't just remove the expression - yank it.
            self.yanked.push(self.expr.remove_by_id(id).unwrap());
        }
    }

    fn render(&mut self, state: &mut RenderingState) {
        const YANK_COLUMN_OFFSET: f32 = 500.;
        let mut canvas = Svg::empty();
        // Reverse to render the last added item first.
        for (index, expr) in self.yanked.iter().rev().enumerate() {
            canvas.place(
                point2(YANK_COLUMN_OFFSET, canvas.size.height + 20.),
                ExprView {
                    id: ExprViewId::Yanked { index },
                    //TODO: How about no.
                    selection: self.selection.as_ref().and_then(|x| {
                        if x.0 == (ExprViewId::Yanked { index }) {
                            Some(x.1)
                        } else {
                            None
                        }
                    }),
                    expr: expr,
                    frozen: false,
                }
                .render(state),
            );
        }
        canvas.place(
            SvgPoint::zero(),
            ExprView {
                id: ExprViewId::Main,
                selection: self.selection.as_ref().and_then(|x| {
                    if x.0 == ExprViewId::Main {
                        Some(x.1)
                    } else {
                        None
                    }
                }),
                expr: &self.expr,
                frozen: false,
            }
            .render(state),
        );
        canvas.mount(&self.root);
    }
}

impl<'a> ExprView<'a> {
    fn render_expr(&self, state: &mut RenderingState, expr: &Expr) -> Svg {
        //TODO: Add a theming api and react to the frozen state.
        const PADDING: f32 = 3.;
        let view_id = self.id.clone();
        let frozen = self.frozen;
        let make_click_handler = |id: ExprId| {
            move |event: ClickEvent| {
                if !frozen {
                    event.stop_propagation();
                    kale().push_event(Event::Select { view_id, id });
                    kale().process_events();
                }
            }
        };
        let transform_handler = |id: ExprId| {
            move |event: DoubleClickEvent| {
                if !frozen {
                    event.stop_propagation();
                    kale().push_event(Event::Edit { view_id, id });
                    kale().process_events();
                }
            }
        };
        let mut rendering = match expr {
            Expr::Comment(e) => Text::new(&e.text, TextStyle::Comment)
                .colour("#43a047")
                .render(state)
                .event(make_click_handler(e.id))
                .event(transform_handler(e.id)),
            Expr::Var(e) => Text::new(&e.name, TextStyle::Mono)
                .colour("#f44336")
                .render(state)
                .event(make_click_handler(e.id))
                .event(transform_handler(e.id)),
            //TODO: Render the lit type somehow or something.
            Expr::Lit(e) => Text::new(&e.content, TextStyle::Mono)
                .colour("#283593")
                .render(state)
                .event(make_click_handler(e.id))
                .event(transform_handler(e.id)),
            Expr::Call(e) => {
                //TODO: Render the underlines/whatever else to help show the nesting level.
                //TODO: The spacing between the arguments might not need be constant. For
                // shorter expressions, or certain functions the spacing could be decreased.
                let mut rendering = Text::new(&e.function, TextStyle::Mono)
                    .render(state)
                    .event(make_click_handler(e.id))
                    .event(transform_handler(e.id));
                rendering.size.width += PADDING;
                for arg in &e.arguments {
                    // Clicking the separator dot selects its argument.
                    rendering.place(
                        point2(rendering.size.width + 3., 2.),
                        Circle::new(point2(3., 3.), 3.)
                            .fill("#aaa")
                            .render(state)
                            .event(make_click_handler(arg.id()))
                            //TODO: This doesn't really work for groups.
                            .event(transform_handler(arg.id())),
                    );
                    rendering.place(
                        point2(rendering.size.width + 1., 0.),
                        self.render_expr(state, arg),
                    );
                    rendering.size.width += PADDING;
                }
                rendering
            }
            Expr::Do(e) => {
                let mut rendering = Svg::empty();
                for expr in &e.expressions {
                    rendering.place(
                        point2(5., rendering.size.height),
                        self.render_expr(state, expr),
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
                        .event(make_click_handler(e.id)),
                );
                rendering
            }
            Expr::Hole(_) => Rect::new(rect(0., 0., 16., 16.)).fill("red").render(state),
        };

        // Handle drawing the selection.
        if self.selection == Some(expr.id()) {
            rendering.place_at(
                0, // Note the zero. Selection should be behind everything else.
                SvgPoint::zero(),
                Rect::new(rect(0., 0., rendering.size.width, rendering.size.height))
                    .stroke("#aaa")
                    .render(state),
            );
        }
        rendering
    }

    fn render(&mut self, state: &mut RenderingState) -> Svg {
        let mut view = self.render_expr(state, &self.expr);
        if self.frozen {
            //TODO: This should actually be on selection only.
            view.place_at(
                0,
                SvgPoint::zero(),
                Rect::new(rect(0., 0., view.size.width, view.size.height))
                    .stroke("#aaa")
                    .render(state),
            );
        }
        view
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
