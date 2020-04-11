import { combineReducers } from "redux";
import { useSelector as useSelectorNative, TypedUseSelectorHook } from "react-redux";

import Workspace from "state/workspace";
import Clipboard from "state/clipboard";

const reducer = combineReducers({ clipboard: Clipboard.reducer, workspace: Workspace.reducer });

export type RootState = ReturnType<typeof reducer>;

export const useSelector: TypedUseSelectorHook<RootState> = useSelectorNative;

export default { reducer };
