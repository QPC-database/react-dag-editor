import * as React from "react";
import { GraphMinimapEvent } from "../../common/GraphEvent.constant";
import { GraphConfigContext, IGraphConfig, PropsAPIContext, ViewPortContext } from "../../contexts";
import { GraphStateContext } from "../../contexts/GraphStateContext";
import { DragController, ITouchHandler, TouchController } from "../../controllers";
import { TouchDragAdapter } from "../../controllers/TouchDragAdapter";
import { MouseMoveEventProvider } from "../../event-provider/MouseMoveEventProvider";
import { IEventProvider, IGlobalMoveEventTypes } from "../../event-provider/types";
import { useMinimapRect, useTheme } from "../../hooks";
import { useRefValue } from "../../hooks/useRefValue";
import {
  getPointDeltaByClientDelta,
  getVisibleArea,
  getZoomFitMatrix,
  isViewPortComplete,
  IZoomPanSettings,
  reverseTransformPoint,
  transformPoint
} from "../../utils";
import { clamp } from "../../utils/clamp";
import classes from "../Graph.styles.m.scss";
import { StaticGraph } from "../StaticGraph/StaticGraph";
import { IRect, MiniMapShadow } from "./Shadow";

export interface IMiniMapProps {
  /**
   * Custom styling for the minimap
   */
  style?: React.CSSProperties;
  /**
   * The padding of the minimap viewport
   *
   * @default 0
   */
  shadowPadding?: number;
  /**
   * The max nodes counts allowed to show in the minimap
   *
   * @default 150
   */
  maxNodesCountAllowed?: number;
  /**
   * The renderer when exceed the max node counts
   *
   * @default () => null
   */
  onRenderUnavailable?(): React.ReactNode;
  /**
   * The renderer to point the graph position when the graph is out of the viewport
   *
   * @param arrowDeg
   */
  renderArrow?(arrowDeg: number): React.ReactNode;
}

export const Minimap: React.FunctionComponent<IMiniMapProps> = props => {
  const {
    shadowPadding = 0,
    maxNodesCountAllowed = 150,
    onRenderUnavailable = () => null,
    renderArrow = (arrowDeg: number) => undefined
  } = props;

  const graphViewPort = React.useContext(ViewPortContext);
  const propsAPI = React.useContext(PropsAPIContext);
  const { theme } = useTheme();
  const { data: dataState } = React.useContext(GraphStateContext).state;
  const data = dataState.present;
  const minimapContainerStyle: React.CSSProperties = {
    background: theme.minimapBackground,
    ...props.style
  };

  const svgRef = React.useRef<SVGSVGElement>(null);
  const graphConfig = React.useContext<IGraphConfig>(GraphConfigContext);

  const rect = useMinimapRect(svgRef);
  const rectRef = useRefValue(rect);

  const miniMapZoomPanSetting = React.useMemo<IZoomPanSettings>(() => {
    return {
      transformMatrix: getZoomFitMatrix({ data, rect, graphConfig })
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rect, data.nodes]);
  const miniMapZoomPanSettingRef = useRefValue(miniMapZoomPanSetting);

  const viewPort = React.useMemo<IRect>(() => {
    if (!rect || !isViewPortComplete(graphViewPort)) {
      return {
        startX: 0,
        startY: 0,
        endX: 0,
        endY: 0
      };
    }

    const boundaryPoints = getVisibleArea(graphViewPort);

    const { x: startX, y: startY } = transformPoint(
      boundaryPoints.minX,
      boundaryPoints.minY,
      miniMapZoomPanSetting.transformMatrix
    );

    const { x: endX, y: endY } = transformPoint(
      boundaryPoints.maxX,
      boundaryPoints.maxY,
      miniMapZoomPanSetting.transformMatrix
    );

    return {
      startX,
      startY,
      endX,
      endY
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rect, miniMapZoomPanSetting, graphViewPort.rect, ...graphViewPort.transformMatrix]);

  const onClick = React.useCallback(
    (evt: React.MouseEvent) => {
      evt.stopPropagation();
      if (!rect) {
        return;
      }
      const viewPortWidth = viewPort.endX - viewPort.startX;
      const viewPortHeight = viewPort.endY - viewPort.startY;
      const point = reverseTransformPoint(
        clamp(
          shadowPadding + viewPortWidth / 2,
          rect.width - shadowPadding - viewPortWidth / 2,
          evt.clientX - rect.left
        ),
        clamp(
          shadowPadding + viewPortHeight / 2,
          rect.height - shadowPadding - viewPortHeight / 2,
          evt.clientY - rect.top
        ),
        miniMapZoomPanSetting.transformMatrix
      );

      propsAPI.scrollIntoView(point.x, point.y);

      propsAPI.getEventChannel()?.trigger({
        type: GraphMinimapEvent.Click,
        rawEvent: evt
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rect]
  );

  const onStartDrag = React.useCallback(
    (evt: MouseEvent, eventProvider: IEventProvider<IGlobalMoveEventTypes>) => {
      if (!rectRef.current) {
        return;
      }
      const { left, top, right, bottom } = rectRef.current;
      const validMouseRect = {
        startX: left + shadowPadding,
        startY: top + shadowPadding,
        endX: right - shadowPadding,
        endY: bottom - shadowPadding
      };

      propsAPI.getEventChannel()?.trigger({
        type: GraphMinimapEvent.PanStart,
        rawEvent: evt
      });
      const drag = new DragController(eventProvider, e => {
        const x = clamp(validMouseRect.startX, validMouseRect.endX, e.clientX);
        const y = clamp(validMouseRect.startY, validMouseRect.endY, e.clientY);
        return {
          x,
          y
        };
      });
      drag.onMove = ({ dx, dy, e }) => {
        const { x, y } = getPointDeltaByClientDelta(-dx, -dy, miniMapZoomPanSettingRef.current.transformMatrix);
        propsAPI.getEventChannel()?.trigger({
          type: GraphMinimapEvent.Pan,
          dx: x,
          dy: y,
          rawEvent: e
        });
      };
      drag.start(evt);

      drag.onEnd = () => {
        propsAPI.getEventChannel()?.trigger({
          type: GraphMinimapEvent.PanEnd,
          rawEvent: evt
        });
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shadowPadding]
  );

  const arrowParams = React.useMemo(() => {
    if (!rect) {
      return {
        showArrow: false,
        arrowDeg: 0
      };
    }

    const showArrow =
      viewPort.startX > rect.width - shadowPadding ||
      viewPort.startY > rect.height - shadowPadding ||
      viewPort.endX < shadowPadding ||
      viewPort.endY < shadowPadding;

    // arrow rotate center
    const x0 = rect.width / 2;
    const y0 = rect.height / 2;

    const x1 = (viewPort.startX + viewPort.endX) / 2;
    const y1 = (viewPort.startY + viewPort.endY) / 2;

    let arrowDeg = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
    if (arrowDeg < 0) {
      arrowDeg = arrowDeg + 360;
    }

    return {
      showArrow,
      arrowDeg
    };
  }, [rect, viewPort, shadowPadding]);

  const onMouseDown: React.MouseEventHandler = React.useCallback(
    evt => {
      onStartDrag(evt.nativeEvent, new MouseMoveEventProvider(graphConfig.getGlobalEventTarget()));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onStartDrag]
  );

  const touchController = React.useMemo(() => {
    const handlers = new Map<number, ITouchHandler>();
    const touchDragAdapter = new TouchDragAdapter();
    touchDragAdapter.on("start", e => {
      onStartDrag(e, touchDragAdapter);
    });
    handlers.set(1, touchDragAdapter);
    return new TouchController(handlers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onStartDrag, rect]);

  const staticGraphEl = React.useMemo(
    () => <StaticGraph data={data} zoomPanSettings={miniMapZoomPanSetting} />,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.nodes, ...miniMapZoomPanSetting.transformMatrix]
  );

  if (data.nodes.size > maxNodesCountAllowed) {
    return (
      <div className="minimap-container" style={minimapContainerStyle}>
        {onRenderUnavailable()}
      </div>
    );
  }

  return (
    <div className={`minimap-container ${classes.minimap}`} style={minimapContainerStyle}>
      {staticGraphEl}
      <svg
        className={classes.minimapSvg}
        {...touchController.eventHandlers}
        onMouseDown={onMouseDown}
        ref={svgRef}
        data-automation-id="minimap-id"
      >
        <MiniMapShadow containerRect={rect} viewPort={viewPort} shadowPadding={shadowPadding} onClick={onClick} />
      </svg>
      {arrowParams.showArrow && renderArrow(arrowParams.arrowDeg)}
    </div>
  );
};
