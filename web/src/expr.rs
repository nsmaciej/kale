use std::collections::HashSet;

pub use Expr::*;

// If we get any more fields in common, something like the diff_enum crate might come in handy.
#[derive(Debug, Clone)]
pub enum Expr {
    Call {
        id: ExprId,
        name: String,
        arguments: Vec<Expr>,
    },
    Lit {
        id: ExprId,
        kind: String,
        content: String,
    },
    Var {
        id: ExprId,
        name: String,
    },
    Do {
        id: ExprId,
        expressions: Vec<Expr>,
    },
}

#[derive(Debug, Clone, Copy)]
pub struct ExprId(u32);

#[macro_export]
macro_rules! _expr_inner {
    ($id:ident; $val:tt => $kind:ident) => {{
        $id += 1;
        Expr::Lit {
            id: ExprId::from_raw($id),
            content: stringify!($val).to_string(),
            kind: stringify!($kind).to_string(),
        }
    }};
    ($id:ident; block $([$($tok:tt)+])*) => {{
        $id += 1;
        Expr::Do {
            id: ExprId::from_raw($id),
            expressions: vec![$(_expr_inner!($id; $($tok)*),)*],
        }
    }};
    ($id:ident; $name:tt($([$($tok:tt)+])*)) => {{
        $id += 1;
        Expr::Call {
            id: ExprId::from_raw($id),
            name: stringify!($name).to_string(),
            arguments: vec![$(_expr_inner!($id; $($tok)*),)*],
        }
    }};
    ($id:ident; $var:tt) => {{
        $id += 1;
        Expr::Var { name: stringify!($var).to_string(), id: ExprId::from_raw($id) }
    }};
}

/// Easily construct expressions and automatically verify them.
#[macro_export]
macro_rules! expr {
    ($($tok:tt)*) => {{
        let mut current_id = 0;
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
            Call { id, .. } | Lit { id, .. } | Var { id, .. } | Do { id, .. } => *id,
        }
    }

    pub fn childeren(&self) -> &[Expr] {
        match self {
            Call { arguments, .. } => arguments,
            Do { expressions, .. } => expressions,
            // I'm kind of surprised this worked, but it makes sense the empty slice should have
            // any lifetime.
            _ => &[],
        }
    }

    // Verify the integiry of an expression tree. Right now this just makes sure that no id appears
    // twice
    pub fn valid(&self) -> bool {
        let mut seen_ids = HashSet::new();
        self.into_iter().all(|x| seen_ids.insert(x.id().0))
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
