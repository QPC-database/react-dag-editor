import * as React from "react";
import { GraphEdgeEvent } from "../common/GraphEvent.constant";
import { GraphConfigContext, IGraphConfig } from "../contexts";
import { VirtualizationContext } from "../contexts/VirtualizationContext";
import { VirtualizationRenderedContext } from "../contexts/VirtualizationRenderedContext";
import { GraphEdgeState, IEdgeCommonEvent } from "../Graph.interface";
import { useTheme } from "../hooks";
import { EdgeModel } from "../models/EdgeModel";
import { GraphModel } from "../models/GraphModel";
import { getEdgeUid, getLinearFunction, hasState, IPoint, IRectShape, isPointInRect } from "../utils";
import { Debug } from "../utils/debug";
import { EventChannel } from "../utils/eventChannel";

export interface IGraphEdgeCommonProps {
  data: GraphModel;
  graphConfig: IGraphConfig;
  eventChannel: EventChannel;
  graphId: string;
}

interface IGraphEdgeProps extends IGraphEdgeCommonProps {
  edge: EdgeModel;
  source: IPoint;
  target: IPoint;
}

function getHintPoints(
  source: IPoint,
  target: IPoint,
  { minX, minY, maxX, maxY }: IRectShape,
  yOnRightAxis: number,
  xOnBottomAxis: number,
  xOnTopAxis: number,
  yOnLeftAxis: number
): IPoint {
  if (source.x === target.x) {
    return {
      x: source.x,
      y: source.y < target.y ? maxY : minY
    };
  }
  if (source.x < target.x) {
    if (source.y < target.y) {
      return yOnRightAxis <= maxY ? { x: maxX, y: yOnRightAxis } : { x: xOnBottomAxis, y: maxY };
    } else {
      return yOnRightAxis >= minY ? { x: maxX, y: yOnRightAxis } : { x: xOnTopAxis, y: minY };
    }
  }
  if (source.y < target.y) {
    return xOnBottomAxis > minX ? { x: xOnBottomAxis, y: maxY } : { x: minX, y: yOnLeftAxis };
  }
  return yOnLeftAxis > minY ? { x: minX, y: yOnLeftAxis } : { x: xOnTopAxis, y: minY };
}

export const GraphEdge: React.FunctionComponent<IGraphEdgeProps> = React.memo(
  // eslint-disable-next-line complexity
  props => {
    const { edge, data: graphModel, eventChannel, source, target, graphId } = props;
    const graphConfig = React.useContext<IGraphConfig>(GraphConfigContext);

    const virtualization = React.useContext(VirtualizationContext);
    const { viewPort, renderedArea, visibleArea } = virtualization;
    const renderedContext = React.useContext(VirtualizationRenderedContext);

    const { theme } = useTheme();

    const edgeEvent = (type: IEdgeCommonEvent["type"]) => (e: React.SyntheticEvent) => {
      e.persist();
      eventChannel.trigger({
        type,
        edge,
        rawEvent: e
      });
    };

    const isSourceRendered = isPointInRect(renderedArea, source);

    const isTargetRendered = isPointInRect(renderedArea, target);

    if (!isSourceRendered && !isTargetRendered) {
      renderedContext.edges.delete(edge.id);
      return null;
    }

    const shape = edge.shape ? edge.shape : graphConfig.defaultEdgeShape;
    const edgeConfig = graphConfig.getEdgeConfigByName(shape);

    if (!edgeConfig) {
      Debug.warn(`invalid shape in edge ${JSON.stringify(edge)}`);
      return null;
    }

    if (!edgeConfig.render) {
      Debug.warn(`Missing "render" method in edge config ${JSON.stringify(edge)}`);
      return null;
    }

    renderedContext.edges.add(edge.id);

    const isSourceVisible = isPointInRect(visibleArea, source);

    const isTargetVisible = isPointInRect(visibleArea, target);

    let edgeNode: React.ReactNode = edgeConfig.render({
      model: edge,
      data: graphModel,
      x1: source.x,
      y1: source.y,
      x2: target.x,
      y2: target.y,
      theme,
      containerRect: viewPort.rect,
      zoomPanSettings: viewPort,
      viewPort
    });

    if (hasState(GraphEdgeState.connectedToSelected)(edge.state) && (!isSourceVisible || !isTargetVisible)) {
      const linearFunction = getLinearFunction(source.x, source.y, target.x, target.y);
      const inverseLinearFunction = getLinearFunction(source.y, source.x, target.y, target.x);
      const hintSource = isSourceVisible ? source : target;
      const hintTarget = isSourceVisible ? target : source;
      const yOnRightAxis = linearFunction(visibleArea.maxX);
      const xOnBottomAxis = inverseLinearFunction(visibleArea.maxY);
      const xOnTopAxis = inverseLinearFunction(visibleArea.minY);
      const yOnLeftAxis = linearFunction(visibleArea.minX);
      const hintPoint = getHintPoints(
        hintSource,
        hintTarget,
        visibleArea,
        yOnRightAxis,
        xOnBottomAxis,
        xOnTopAxis,
        yOnLeftAxis
      );
      if (isSourceVisible && edgeConfig.renderWithTargetHint) {
        edgeNode = edgeConfig.renderWithTargetHint({
          model: edge,
          data: graphModel,
          x1: source.x,
          y1: source.y,
          x2: hintPoint.x,
          y2: hintPoint.y,
          theme,
          containerRect: viewPort.rect,
          zoomPanSettings: viewPort,
          viewPort
        });
      } else if (isTargetVisible && edgeConfig.renderWithSourceHint) {
        edgeNode = edgeConfig.renderWithSourceHint({
          model: edge,
          data: graphModel,
          x1: hintPoint.x,
          y1: hintPoint.y,
          x2: target.x,
          y2: target.y,
          theme,
          containerRect: viewPort.rect,
          zoomPanSettings: viewPort,
          viewPort
        });
      }
    }

    const id = getEdgeUid(graphId, edge);
    const className = `edge-container-${edge.id}`;
    const automationId = edge.automationId ?? className;

    return (
      <g
        id={id}
        onClick={edgeEvent(GraphEdgeEvent.Click)}
        onDoubleClick={edgeEvent(GraphEdgeEvent.DoubleClick)}
        onMouseDown={edgeEvent(GraphEdgeEvent.MouseDown)}
        onMouseUp={edgeEvent(GraphEdgeEvent.MouseUp)}
        onMouseEnter={edgeEvent(GraphEdgeEvent.MouseEnter)}
        onMouseLeave={edgeEvent(GraphEdgeEvent.MouseLeave)}
        onContextMenu={edgeEvent(GraphEdgeEvent.ContextMenu)}
        onMouseMove={edgeEvent(GraphEdgeEvent.MouseMove)}
        onMouseOver={edgeEvent(GraphEdgeEvent.MouseOver)}
        onMouseOut={edgeEvent(GraphEdgeEvent.MouseOut)}
        onFocus={undefined}
        onBlur={undefined}
        className={className}
        data-automation-id={automationId}
      >
        {edgeNode}
      </g>
    );
  }
);
