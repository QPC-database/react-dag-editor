import { GraphEdgeEvent } from "../common/GraphEvent.constant";
import { GraphFeatures } from "../Features";
import { GraphEdgeState } from "../Graph.interface";
import { addState, pushHistory, removeState, resetState, unSelectAllEntity, updateState } from "../utils";
import { graphController } from "../utils/graphController";
import { IBuiltinReducer } from "./builtinReducer.type";

export const edgeReducer: IBuiltinReducer = (state, action) => {
  switch (action.type) {
    case GraphEdgeEvent.DoubleClick:
      if (!graphController.getEnabledFeatures().has(GraphFeatures.editEdge)) {
        return state;
      }
      return {
        ...state,
        data: {
          ...state.data,
          present: state.data.present.updateEdge(action.edge.id, updateState(resetState(GraphEdgeState.editing)))
        }
      };
    case GraphEdgeEvent.MouseEnter:
      return {
        ...state,
        data: {
          ...state.data,
          present: state.data.present.updateEdge(action.edge.id, updateState(addState(GraphEdgeState.activated)))
        }
      };
    case GraphEdgeEvent.MouseLeave:
      return {
        ...state,
        data: {
          ...state.data,
          present: state.data.present.updateEdge(action.edge.id, updateState(removeState(GraphEdgeState.activated)))
        }
      };
    case GraphEdgeEvent.Click:
    case GraphEdgeEvent.ContextMenu:
      return {
        ...state,
        data: {
          ...state.data,
          present: unSelectAllEntity()(state.data.present).updateEdge(
            action.edge.id,
            updateState(addState(GraphEdgeState.selected))
          )
        }
      };
    case GraphEdgeEvent.Add:
      return {
        ...state,
        data: pushHistory(state.data, state.data.present.insertEdge(action.edge))
      };
    default:
      return state;
  }
};
