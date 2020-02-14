import {
    Expr,
    Hole,
    List,
    Call,
    Variable,
    InvalidExpr,
    exprData,
    Literal,
} from "./expr";
import SAMPLE_EXPR from "./sample";

const foo = new Variable("foo");
const bar = new Variable("bar");
const baz = new Variable("bar");

describe("remove", () => {
    test("returns null if replacing this", () => {
        const expr = new Hole();
        expect(expr.remove(expr)).toBeNull();
    });

    test("works on lists", () => {
        const expr = new List([foo, bar, baz]).validate();
        const r = expr.remove(bar) as List;
        expect(r).toBeInstanceOf(List);
        expect(r.list).toMatchObject([foo, baz]);
    });

    test("works on calls", () => {
        const expr = new Call("test", [foo]).validate();
        const r = expr.remove(foo) as Call;
        expect(r).toBeInstanceOf(Call);
        expect(r.fn).toBe("test");
        expect(r.args).toHaveLength(0);
    });

    //TODO: Really this should be testing filterMap.
    test("destroys one element lists", () => {
        const expr = new List([foo, bar]).validate();
        const r = expr.remove(foo) as List;
        expect(r).toBe(bar);
    });

    test("works on complex expressions", () => {
        const print = (SAMPLE_EXPR.args[1] as List).list[0] as Call;
        expect(print.fn).toBe("print");
        const r = SAMPLE_EXPR.remove(print) as Call;
        expect(r.args[1]).toBeInstanceOf(Literal);
    });
});

describe("validate", () => {
    test("rejects duplicate ids", () => {
        expect(() => new List([foo, foo]).validate()).toThrow(InvalidExpr);
        expect(() => new Call("foo", [foo, foo]).validate()).toThrow(
            InvalidExpr,
        );
    });

    test("rejects empty comments", () => {
        expect(() => new Hole(exprData("")).validate()).toThrow(InvalidExpr);
    });
});
