use std::collections::HashSet;
use std::fmt;

use itertools::Itertools;

pub use Expr::*;

macro_rules! make_expr {
    ($enum_vis:vis enum $expr_name:ident { .. }
     $($variant_vis:vis struct $variant:ident { $($name:ident : $type:ty,)* })*) => {
        $(
            #[derive(Debug, Clone)]
            $variant_vis struct $variant {
                $(pub $name: $type,)*
            }
        )*
        #[derive(Debug, Clone)]
        $enum_vis enum $expr_name {
            $($variant($variant),)*
        }
    };
}

// Once https://github.com/rust-lang/rfcs/pull/2593 "Enum Variant Types" lands (hopefully early
// 2020), this should be able to go away. Until then it's much nicer to deal with an enum of structs
// for our purposes than a plain enum. It lets us handle known variants much more neatly and use the
// struct update syntax.
make_expr! {
    pub enum Expr {
        ..
    }

    pub struct Hole {
        id: ExprId,
    }
    pub struct Comment {
        id: ExprId,
        text: String,
    }
    pub struct Call {
        id: ExprId,
        name: String,
        arguments: Vec<Expr>,
    }
    pub struct Lit {
        id: ExprId,
        kind: String,
        content: String,
    }
    pub struct Var {
        id: ExprId,
        name: String,
    }
    pub struct Do {
        id: ExprId,
        expressions: Vec<Expr>,
    }
}

#[repr(transparent)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct ExprId(u32);

/// Internals of the expr macro.
#[macro_export]
macro_rules! _expr_inner {
    ($id:ident; $val:tt => $kind:ident) => {{
        $id += 1;
        Expr::Lit(Lit {
            id: ExprId::from_raw($id),
            content: stringify!($val).to_string(),
            kind: stringify!($kind).to_string(),
        })
    }};
    ($id:ident; block $([$($tok:tt)+])*) => {{
        $id += 1;
        Expr::Do(Do {
            id: ExprId::from_raw($id),
            expressions: vec![$(_expr_inner!($id; $($tok)*),)*],
        })
    }};
    ($id:ident; comment $text:expr) => {{
        $id += 1;
        Expr::Comment(Comment {
            id: ExprId::from_raw($id),
            text: $text.to_string(),
        })
    }};
    ($id:ident; hole) => {{
        $id += 1;
        Expr::Hole(Hole { id: ExprId::from_raw($id) })
    }};
    ($id:ident; $name:tt($([$($tok:tt)+])*)) => {{
        $id += 1;
        Expr::Call(Call {
            id: ExprId::from_raw($id),
            name: stringify!($name).to_string(),
            arguments: vec![$(_expr_inner!($id; $($tok)*),)*],
        })
    }};
    ($id:ident; $var:tt) => {{
        $id += 1;
        Expr::Var(Var { name: stringify!($var).to_string(), id: ExprId::from_raw($id) })
    }};
}

/// Easily construct expressions and automatically verify them.
#[macro_export]
macro_rules! expr {
    ($($tok:tt)*) => {{
        let mut current_id = 0;
        #[allow(clippy::eval_order_dependence)]
        let expr = _expr_inner!(current_id; $($tok)*);
        assert!(expr.valid());
        expr
    }}
}

impl ExprId {
    pub fn from_raw(id: u32) -> Self {
        ExprId(id)
    }
}

impl Expr {
    pub fn id(&self) -> ExprId {
        match self {
            Call(x) => x.id,
            Comment(x) => x.id,
            Do(x) => x.id,
            Hole(x) => x.id,
            Lit(x) => x.id,
            Var(x) => x.id,
        }
    }

    pub fn find_by_id(&self, id: ExprId) -> Option<&Expr> {
        self.into_iter().find(|x| x.id() == id)
    }

    pub fn childeren(&self) -> &[Expr] {
        match self {
            Call(x) => &x.arguments,
            Do(x) => &x.expressions,
            // I'm kind of surprised this worked, but it makes sense the empty slice should have
            // any lifetime.
            _ => &[],
        }
    }

    // Verify the integiry of an expression tree. Right now this just makes sure that no id appears
    // twice
    pub fn valid(&self) -> bool {
        let mut seen_ids = HashSet::new();
        self.into_iter().all(|x| seen_ids.insert(x.id()))
    }
}

impl fmt::Display for Expr {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Call(x) => write!(f, "{}({})", x.name, x.arguments.iter().format(", ")),
            Comment(x) => write!(f, "/* {} */", x.text),
            Do(x) => write!(f, "{{{}}}", x.expressions.iter().format(", ")),
            Hole(_) => write!(f, "?"),
            Lit(x) => write!(f, "{}:{}", x.content, x.kind),
            Var(x) => write!(f, "{}", x.name),
        }
    }
}

impl<'a> IntoIterator for &'a Expr {
    type Item = &'a Expr;
    type IntoIter = ExprIterator<'a>;

    fn into_iter(self) -> Self::IntoIter {
        ExprIterator { queue: vec![&self] }
    }
}

pub struct ExprIterator<'a> {
    queue: Vec<&'a Expr>,
}

impl<'a> Iterator for ExprIterator<'a> {
    type Item = &'a Expr;
    fn next(&mut self) -> Option<Self::Item> {
        let item = self.queue.pop();
        if let Some(item) = item {
            self.queue.extend(item.childeren().iter());
        }
        item
    }
}
