use std::collections::HashSet;
use std::fmt;

use itertools::Itertools;

pub use Expr::*;

/// Create an enum from a list of structs. Structs inherit the visibility given to the enum and all
/// their fields are public.
macro_rules! make_expr {
    ($(#[$enum_meta:meta])* $vis:vis enum $expr_name:ident { .. }
     $($(#[$variant_meta:meta])* struct $variant:ident { $($name:ident : $type:ty,)* })*) => {
        $(
            $(#[$variant_meta])*
            #[derive(Debug, Clone)]
            $vis struct $variant {
                $(pub $name: $type,)*
            }

            impl From<$variant> for Expr {
                fn from(expr: $variant) -> Self {
                    $variant(expr)
                }
            }
        )*
        $(#[$enum_meta])*
        $vis enum $expr_name {
            $($variant($variant),)*
        }
    };
}

// Once https://github.com/rust-lang/rfcs/pull/2593 "Enum Variant Types" lands (hopefully early
// 2020), this should be able to go away. Until then it's much nicer to deal with an enum of structs
// for our purposes than a plain enum. It lets us handle known variants much more neatly and use the
// struct update syntax.
make_expr! {
    #[derive(Debug, Clone)]
    pub enum Expr {
        ..
    }

    struct Hole {
        id: ExprId,
    }
    struct Comment {
        id: ExprId,
        text: String,
    }
    struct Call {
        id: ExprId,
        function: String,
        arguments: Vec<Expr>,
    }
    struct Lit {
        id: ExprId,
        kind: String,
        content: String,
    }
    struct Var {
        id: ExprId,
        name: String,
    }
    /// A group of expressions, like progn.
    struct Do {
        id: ExprId,
        expressions: Vec<Expr>,
    }
}

/// A unique number identifying an expression.
#[repr(transparent)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct ExprId(u32);

/// Internals of the expr macro.
#[macro_export]
macro_rules! _expr_inner {
    ($id:ident; $val:tt => $kind:ident) => {{
        $id += 1;
        Lit {
            id: ExprId::from_raw($id),
            content: stringify!($val).to_string(),
            kind: stringify!($kind).to_string(),
        }.into()
    }};
    ($id:ident; block $([$($tok:tt)+])*) => {{
        $id += 1;
        Do {
            id: ExprId::from_raw($id),
            expressions: vec![$(_expr_inner!($id; $($tok)*),)*],
        }.into()
    }};
    ($id:ident; comment $text:expr) => {{
        $id += 1;
        Comment {
            id: ExprId::from_raw($id),
            text: $text.to_string(),
        }.into()
    }};
    ($id:ident; hole) => {{
        $id += 1;
        Hole { id: ExprId::from_raw($id) }.into()
    }};
    ($id:ident; $name:tt($([$($tok:tt)+])*)) => {{
        $id += 1;
        Call {
            id: ExprId::from_raw($id),
            function: stringify!($name).to_string(),
            arguments: vec![$(_expr_inner!($id; $($tok)*),)*],
        }.into()
    }};
    ($id:ident; $var:tt) => {{
        $id += 1;
        Var { name: stringify!($var).to_string(), id: ExprId::from_raw($id) }.into()
    }};
}

/// Easily construct expressions and automatically verify them.
#[macro_export]
macro_rules! expr {
    ($($tok:tt)*) => {{
        let mut current_id = 0;
        #[allow(clippy::eval_order_dependence)]
        let expr: Expr = _expr_inner!(current_id; $($tok)*);
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

    pub fn update(&mut self, id: ExprId, transform: impl Fn(Expr) -> Expr + Copy) {
        use std::mem::replace;
        if self.id() == id {
            *self = transform(replace(self, Expr::default()));
        } else {
            for child in self.childeren_mut() {
                Expr::update(child, id, transform);
            }
        }
    }

    pub fn childeren(&self) -> &[Expr] {
        match self {
            Call(x) => &x.arguments,
            Do(x) => &x.expressions,
            _ => &[],
        }
    }

    pub fn childeren_mut(&mut self) -> &mut [Expr] {
        match self {
            Call(x) => &mut x.arguments,
            Do(x) => &mut x.expressions,
            _ => &mut [],
        }
    }

    /// Verify the integiry of an expression tree. Right now this just makes sure that no id appears
    /// twice
    pub fn valid(&self) -> bool {
        let mut seen_ids = HashSet::new();
        self.into_iter().all(|x| seen_ids.insert(x.id()))
    }
}

impl Default for Expr {
    fn default() -> Self {
        Hole {
            id: ExprId::from_raw(0),
        }
        .into()
    }
}

impl fmt::Display for Expr {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Call(x) => write!(f, "{}({})", x.function, x.arguments.iter().format(", ")),
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
