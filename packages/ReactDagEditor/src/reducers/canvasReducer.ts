import { COPIED_NODE_SPACING } from "../common/constants";
import { GraphCanvasEvent } from "../common/GraphEvent.constant";
import { GraphNodeState } from "../Graph.interface";
import {
  getRealPointFromClientPoint,
  isViewPortComplete,
  notSelected,
  resetUndoStack,
  unSelectAllEntity
} from "../utils";
import { pushHistory, redo, undo } from "../utils/history";
import { IBuiltinReducer } from "./builtinReducer.type";

export const canvasReducer: IBuiltinReducer = (state, action) => {
  switch (action.type) {
    case GraphCanvasEvent.Paste: {
      const { position } = action;
      if (!isViewPortComplete(state.viewPort)) {
        return state;
      }
      const { rect } = state.viewPort;
      let pasteNodes = action.data.nodes;

      if (position && rect) {
        const realPoint = getRealPointFromClientPoint(position.x, position.y, state.viewPort);

        let dx: number;
        let dy: number;

        pasteNodes = pasteNodes.map((n, idx) => {
          // (dx,dy) are same for all copied nodes
          if (idx === 0) {
            dx = realPoint.x - n.x;
            dy = realPoint.y - n.y;
          }

          return {
            ...n,
            x: dx ? n.x - COPIED_NODE_SPACING + dx : n.x,
            y: dy ? n.y - COPIED_NODE_SPACING + dy : n.y,
            state: GraphNodeState.selected
          };
        });
      }

      let next = unSelectAllEntity()(state.data.present);
      pasteNodes.forEach(node => {
        next = next.insertNode(node);
      });
      action.data.edges.forEach(edge => {
        next = next.insertEdge(edge);
      });
      return {
        ...state,
        data: pushHistory(state.data, next)
      };
    }
    case GraphCanvasEvent.Delete:
      return {
        ...state,
        data: pushHistory(
          state.data,
          state.data.present.deleteItems({
            node: notSelected,
            edge: notSelected
          }),
          unSelectAllEntity()
        )
      };
    case GraphCanvasEvent.Undo:
      return {
        ...state,
        data: undo(state.data)
      };
    case GraphCanvasEvent.Redo:
      return {
        ...state,
        data: redo(state.data)
      };
    case GraphCanvasEvent.KeyDown: {
      const key = action.rawEvent.key.toLowerCase();
      if (state.activeKeys.has(key)) {
        return state;
      }
      const set = new Set(state.activeKeys);
      set.add(key);
      return {
        ...state,
        activeKeys: set
      };
    }
    case GraphCanvasEvent.KeyUp: {
      const key = action.rawEvent.key.toLowerCase();
      if (!state.activeKeys.has(key)) {
        return state;
      }
      const set = new Set(state.activeKeys);
      set.delete(key);
      return {
        ...state,
        activeKeys: set
      };
    }
    case GraphCanvasEvent.SetData:
      return {
        ...state,
        data: resetUndoStack(action.data)
      };
    case GraphCanvasEvent.UpdateData:
      return {
        ...state,
        data: action.shouldRecord
          ? pushHistory(state.data, action.updater(state.data.present))
          : {
              ...state.data,
              present: action.updater(state.data.present)
            }
      };
    case GraphCanvasEvent.ResetUndoStack:
      return {
        ...state,
        data: resetUndoStack(state.data.present)
      };
    default:
      return state;
  }
};
