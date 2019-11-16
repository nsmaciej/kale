#![feature(vec_remove_item)]

/// KaleLisp expressions.
mod expr;
/// Rendering engine.
mod render;

use euclid::{point2, rect, size2};
use log::*;
use stdweb::web::{document, Element, INode};
use web_logger;

use expr::*;
use render::*;

/// Data about a particual instance of the Kale editor.
struct Editor {
    root: Element,
    frozen: bool,
    expr: Expr,
    // We assume the user will only ever select a few expressions.
    selection: Vec<ExprId>,
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

    fn select(&mut self, id: ExprId) {
        if !self.selection.contains(&id) {
            // Remove all the children of the new selection.
            for expr in self.expr.find_by_id(id) {
                self.selection.remove_item(&expr.id());
            }
            self.selection.push(id);
        }
    }

    fn render(&mut self, state: &mut RenderingState) {
        fn render(editor: &Editor, state: &mut RenderingState, expr: &Expr) -> ExprRendering {
            const PADDING: f32 = 3.;
            let mut rendering = match expr {
                Comment { id, text, .. } => Text::new(text, TextStyle::Comment)
                    .colour("#43a047")
                    .render(state)
                    .click(*id),
                Var { id, name, .. } => Text::new(name, TextStyle::Mono)
                    .colour("#f44336")
                    .render(state)
                    .click(*id),
                Lit { id, content, .. } => Text::new(content, TextStyle::Mono)
                    .colour("#283593")
                    .render(state)
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
                    let mut rendering = Text::new(name, TextStyle::Mono).render(state).click(*id);
                    rendering.size.width += PADDING;
                    for arg in arguments {
                        // Clicking the separator dot selects its argument.
                        rendering.place(
                            point2(rendering.size.width + 3., 2.),
                            Circle::new(point2(3., 3.), 3.)
                                .fill("#aaa")
                                .render(state)
                                .click(arg.id()),
                        );
                        rendering.place(
                            point2(rendering.size.width + 1., 0.),
                            render(editor, state, arg),
                        );
                        rendering.size.width += PADDING;
                    }
                    rendering
                }
                Do {
                    id, expressions, ..
                } => {
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
                            .click(*id),
                    );
                    rendering
                }
            };

            // Handle drawing the selection.
            if editor.selection.contains(&expr.id()) {
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
    editor.selection.push(ExprId::from_raw(5));
    editor.expr = fact;
    editor.render(&mut state);
}
