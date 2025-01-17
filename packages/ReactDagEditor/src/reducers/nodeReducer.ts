import * as React from "react";
import { GraphCanvasEvent, GraphNodeEvent } from "../common/GraphEvent.constant";
import { emptyDummyNodes, IDummyNode, IDummyNodes } from "../components/dummyNodes";
import { IGraphConfig, IGraphReducerContext } from "../contexts";
import { GraphBehavior, IGraphState } from "../contexts/GraphStateContext";
import { GraphFeatures } from "../Features";
import {
  GraphNodeState,
  ICanvasAddNodeEvent,
  INodeCentralizeEvent,
  INodeDragEndEvent,
  INodeDragEvent,
  INodeDragStartEvent,
  INodeLocateEvent
} from "../Graph.interface";
import { GraphModel } from "../models/GraphModel";
import {
  addState,
  focusArea,
  getContentArea,
  getNodeSize,
  getPointDeltaByClientDelta,
  getRelativePoint,
  getRenderedNodes,
  isSelected,
  isViewPortComplete,
  pan,
  pushHistory,
  removeState,
  scrollIntoView,
  transformPoint,
  unSelectAllEntity,
  updateState,
  zoom
} from "../utils";
import { getAlignmentLines, getAutoAlignDisplacement } from "../utils/autoAlign";
import { graphController } from "../utils/graphController";
import { pipe } from "../utils/pipe";
import { IBuiltinReducer } from "./builtinReducer.type";

const getDelta = (start: number, end: number, value: number): number => {
  if (value < start) {
    return -10;
  }
  if (value > end) {
    return 10;
  }
  return 0;
};

function getSelectedNodes(data: GraphModel, graphConfig: IGraphConfig): IDummyNode[] {
  const nodes: IDummyNode[] = [];
  data.nodes.forEach(node => {
    if (!isSelected(node)) {
      return;
    }
    nodes.push({
      id: node.id,
      x: node.x,
      y: node.y,
      ...getNodeSize(node, graphConfig)
    });
  });
  return nodes;
}

function dragNodeHandler(state: IGraphState, event: INodeDragEvent, context: IGraphReducerContext): IGraphState {
  if (!isViewPortComplete(state.viewPort)) {
    return state;
  }
  const e = event.rawEvent as MouseEvent;
  const { visibleRect, rect } = state.viewPort;
  const nextState = {
    ...state
  };
  const data = state.data.present;
  const viewPortDx = getDelta(visibleRect.left, visibleRect.right, e.clientX);
  const viewPortDy = getDelta(visibleRect.top, visibleRect.bottom, e.clientY);
  const scale = viewPortDx !== 0 || viewPortDy !== 0 ? 0.999 : 1;
  const viewPort =
    viewPortDx !== 0 || viewPortDx !== 0
      ? pipe(pan(-viewPortDx, -viewPortDy), zoom(scale, getRelativePoint(rect, e)))(state.viewPort)
      : state.viewPort;
  const delta = getPointDeltaByClientDelta(
    event.dx + viewPortDx * scale,
    event.dy + viewPortDy * scale,
    viewPort.transformMatrix
  );
  const dummyNodes: IDummyNodes = {
    ...state.dummyNodes,
    dx: state.dummyNodes.dx + delta.x,
    dy: state.dummyNodes.dy + delta.y,
    isVisible: event.isVisible
  };
  if (event.isAutoAlignEnable) {
    const renderedNodes = getRenderedNodes(data.nodes, state.viewPort);
    if (renderedNodes.length < event.autoAlignThreshold) {
      const nodes = dummyNodes.nodes.map(it => ({
        ...it,
        x: it.x + dummyNodes.dx,
        y: it.y + dummyNodes.dy
      }));
      const alignmentLines = getAlignmentLines(
        nodes,
        renderedNodes,
        context.graphConfig,
        state.viewPort.transformMatrix[0] > 0.3 ? 2 : 5
      );
      if (alignmentLines.length) {
        const dxAligned = getAutoAlignDisplacement(alignmentLines, nodes, context.graphConfig, "x");
        const dyAligned = getAutoAlignDisplacement(alignmentLines, nodes, context.graphConfig, "y");
        dummyNodes.alignedDX = dummyNodes.dx + dxAligned;
        dummyNodes.alignedDY = dummyNodes.dy + dyAligned;
      } else {
        dummyNodes.alignedDX = undefined;
        dummyNodes.alignedDY = undefined;
      }
      nextState.alignmentLines = alignmentLines;
    } else {
      dummyNodes.alignedDX = undefined;
      dummyNodes.alignedDY = undefined;
    }
  }
  nextState.dummyNodes = dummyNodes;
  nextState.viewPort = viewPort;
  return nextState;
}

function handleDraggingNewNode(
  state: IGraphState,
  action: ICanvasAddNodeEvent,
  context: IGraphReducerContext
): IGraphState {
  if (!context.features.has(GraphFeatures.autoAlign)) {
    return state;
  }
  const data = state.data.present;
  const renderedNodes = getRenderedNodes(data.nodes, state.viewPort);
  const alignmentLines = getAlignmentLines(
    [action.node],
    renderedNodes,
    context.graphConfig,
    state.viewPort.transformMatrix[0] > 0.3 ? 2 : 5
  );
  return {
    ...state,
    alignmentLines
  };
}

function dragStart(state: IGraphState, action: INodeDragStartEvent, context: IGraphReducerContext): IGraphState {
  let data = state.data.present;
  const targetNode = data.nodes.get(action.node.id);
  if (!targetNode) {
    return state;
  }
  let selectedNodes: IDummyNode[];
  if (action.isMultiSelect) {
    data = data.selectNodes(node => node.id === action.node.id || isSelected(node));
    selectedNodes = getSelectedNodes(data, context.graphConfig);
  } else if (!isSelected(targetNode)) {
    selectedNodes = [
      {
        id: action.node.id,
        x: action.node.x,
        y: action.node.y,
        ...getNodeSize(action.node, context.graphConfig)
      }
    ];
  } else {
    selectedNodes = getSelectedNodes(data, context.graphConfig);
  }
  return {
    ...state,
    data: {
      ...state.data,
      present: data
    },
    dummyNodes: {
      ...emptyDummyNodes(),
      isVisible: false,
      nodes: selectedNodes
    }
  };
}

function dragEnd(state: IGraphState, action: INodeDragEndEvent): IGraphState {
  let data = state.data.present;
  if (action.isDragCanceled) {
    return {
      ...state,
      alignmentLines: [],
      dummyNodes: emptyDummyNodes()
    };
  }
  const { dx, dy } = state.dummyNodes;
  data = data.updateNodesPositionAndSize(
    state.dummyNodes.nodes.map(node => ({
      ...node,
      x: node.x + dx,
      y: node.y + dy,
      width: undefined,
      height: undefined
    }))
  );
  return {
    ...state,
    alignmentLines: [],
    dummyNodes: emptyDummyNodes(),
    data: pushHistory(state.data, data, unSelectAllEntity())
  };
}

// centralize node or locate node to the specific position
function locateNode(
  action: INodeCentralizeEvent | INodeLocateEvent,
  state: IGraphState,
  graphConfig: IGraphConfig
): IGraphState {
  const data = state.data.present;
  if (!isViewPortComplete(state.viewPort) || !action.nodes.length) {
    return state;
  }
  if (action.nodes.length === 1) {
    const nodeId = action.nodes[0];
    const node = data.nodes.get(nodeId);
    if (!node) {
      return state;
    }

    const { width, height } = getNodeSize(node, graphConfig);
    const nodeX = action.type === GraphNodeEvent.Centralize ? node.x + width / 2 : node.x;
    const nodeY = action.type === GraphNodeEvent.Centralize ? node.y + height / 2 : node.y;

    const { x: clientX, y: clientY } = transformPoint(nodeX, nodeY, state.viewPort.transformMatrix);
    const position = action.type === GraphNodeEvent.Locate ? action.position : undefined;

    return {
      ...state,
      viewPort: scrollIntoView(clientX, clientY, state.viewPort.rect, true, position)(state.viewPort)
    };
  }
  const { minNodeX, minNodeY, maxNodeX, maxNodeY } = getContentArea(data, graphConfig, new Set(action.nodes));
  return {
    ...state,
    viewPort: focusArea(minNodeX, minNodeY, maxNodeX, maxNodeY, state.viewPort)
  };
}

export const nodeReducer: IBuiltinReducer = (state, action, context) => {
  const data = state.data.present;
  switch (action.type) {
    //#region resize
    case GraphNodeEvent.ResizingStart:
      return {
        ...state,
        dummyNodes: {
          ...emptyDummyNodes(),
          isVisible: true,
          nodes: getSelectedNodes(data, context.graphConfig)
        }
      };
    case GraphNodeEvent.Resizing:
      return {
        ...state,
        dummyNodes: {
          ...state.dummyNodes,
          dx: action.dx,
          dy: action.dy,
          dWidth: action.dWidth,
          dHeight: action.dHeight
        }
      };
    case GraphNodeEvent.ResizingEnd: {
      const { dx, dy, dWidth, dHeight } = state.dummyNodes;
      return {
        ...state,
        dummyNodes: emptyDummyNodes(),
        data: pushHistory(
          state.data,
          data.updateNodesPositionAndSize(
            state.dummyNodes.nodes.map(node => ({
              ...node,
              x: node.x + dx,
              y: node.y + dy,
              width: node.width + dWidth,
              height: node.height + dHeight
            }))
          ),
          unSelectAllEntity()
        )
      };
    }
    //#endregion resize

    //#region drag
    case GraphNodeEvent.DragStart:
      return dragStart(state, action, context);
    case GraphNodeEvent.Drag:
      return dragNodeHandler(state, action, context);
    case GraphNodeEvent.DragEnd:
      return dragEnd(state, action);
    //#endregion drag

    case GraphNodeEvent.PointerEnter:
      switch (state.behavior) {
        case GraphBehavior.connecting:
          if ((action.rawEvent as React.PointerEvent).pointerId !== graphController.pointerId) {
            return state;
          }
        // eslint-disable-next-line no-fallthrough
        case GraphBehavior.default:
          return {
            ...state,
            data: {
              ...state.data,
              present: data.updateNode(action.node.id, updateState(addState(GraphNodeState.activated)))
            }
          };
        default:
          return state;
      }
    case GraphNodeEvent.PointerLeave:
      switch (state.behavior) {
        case GraphBehavior.default:
        case GraphBehavior.connecting:
          return {
            ...state,
            data: {
              ...state.data,
              present: data.updateNode(action.node.id, updateState(removeState(GraphNodeState.activated)))
            }
          };
        default:
          return state;
      }
    case GraphCanvasEvent.DraggingNodeFromItemPanel:
      return handleDraggingNewNode(state, action, context);
    case GraphCanvasEvent.DraggingNodeFromItemPanelEnd: {
      if (action.node) {
        return {
          ...state,
          alignmentLines: [],
          data: pushHistory(
            state.data,
            state.data.present.insertNode({
              ...action.node,
              state: GraphNodeState.selected
            }),
            unSelectAllEntity()
          )
        };
      }
      return {
        ...state,
        alignmentLines: []
      };
    }
    case GraphNodeEvent.Centralize:
    case GraphNodeEvent.Locate:
      return locateNode(action, state, context.graphConfig);
    case GraphNodeEvent.Add:
      return {
        ...state,
        data: pushHistory(state.data, data.insertNode(action.node))
      };
    default:
      return state;
  }
};
