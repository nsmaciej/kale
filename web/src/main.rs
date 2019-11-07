use itertools::Itertools;
use std::fmt;
use stdweb::web::alert;

use Expr::*;

#[derive(Debug, Clone)]
enum Expr {
    Call { name: String, arguments: Vec<Expr> },
    Lit { kind: String, content: String },
}

impl fmt::Display for Expr {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Call { name, arguments } => write!(f, "{}({})", name, arguments.iter().format(",")),
            Lit { kind, content } => write!(f, "{}:{}", content, kind),
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

fn main() {
    let demo = call!("print", lit!("Hello, world!" => str));
    alert(&format!("{}", demo));
}
