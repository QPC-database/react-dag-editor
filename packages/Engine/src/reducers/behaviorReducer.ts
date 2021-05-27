import { GraphCanvasEvent, GraphEdgeEvent, GraphNodeEvent } from "../common/GraphEvent.constant";
import { GraphBehavior } from "../contexts/GraphStateContext";
import { IEvent } from "../Graph.interface";
import { IBuiltinReducer } from "./builtinReducer.type";

/**
 * this function is used both in useEventChannel and behaviorReducer to share the same logic
 */
export const handleBehaviorChange = (prevBehavior: GraphBehavior, event: IEvent): GraphBehavior => {
  switch (event.type) {
    case GraphNodeEvent.DragStart:
      return GraphBehavior.dragging;
    case GraphEdgeEvent.ConnectStart:
      return GraphBehavior.connecting;
    case GraphCanvasEvent.SelectStart:
      return GraphBehavior.multiSelect;
    case GraphCanvasEvent.DragStart:
      return GraphBehavior.panning;
    case GraphCanvasEvent.DraggingNodeFromItemPanelStart:
      return GraphBehavior.addingNode;
    case GraphNodeEvent.DragEnd:
    case GraphEdgeEvent.ConnectEnd:
    case GraphCanvasEvent.SelectEnd:
    case GraphCanvasEvent.DragEnd:
    case GraphCanvasEvent.DraggingNodeFromItemPanelEnd:
      return GraphBehavior.default;
    default:
      return prevBehavior;
  }
};

export const behaviorReducer: IBuiltinReducer = (prevState, action) => {
  const nextBehavior = handleBehaviorChange(prevState.behavior, action);

  if (nextBehavior === prevState.behavior) {
    return prevState;
  }

  return {
    ...prevState,
    behavior: nextBehavior
  };
};
