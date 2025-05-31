import { DebugPanel } from "./utils/DebugPanel";
import { LiveState } from "./utils/sync";
import { DEBUG_ITER, DEBUG_EMOJI, mapEntityToEmoji } from "./utils/debugging";
import { computeMassAfterJumpingLine, GameConfig } from "./utils/game/configLib";
import {
  computeDiameter,
  isBoundaryEntity,
  computeX,
  computeVelocity,
  EntityType,
  Entity,
  isPoweredUp,
} from "./utils/game/entityLib";
import { useRef, useState } from "react";
import { SmallCrab, MediumCrab, BigCrab } from "./utils/icons";
import { colorToGlowClass, calculateLineVisibility } from "./utils/lineUI";

export function Lines({
  liveState,
  gameConfig,
  onLineClick,
  onSpawnRequest,
}: {
  liveState: LiveState;
  gameConfig: GameConfig;
  onLineClick?: (lineId: number) => void;
  onSpawnRequest?: (
    lineId: number,
    rightNeighbor: bigint,
    velRight: boolean
  ) => void;
}) {
  const { lastProcessedTime, lines, lineStates, gameState } = liveState;

  const configLineWidth = gameConfig.lineWidth.fromWad(); // Cache here to avoid recomputing.

  const containerRef = useRef<HTMLDivElement | null>(null);

  // If the game config's line width is greater than the container's width, we need to
  // scale both the width and height of the all the lines and the entities within them.
  const scale = Math.min(
    1,
    (containerRef.current?.offsetWidth ?? 1000) / configLineWidth
  );

  const [hoveredEntity, setHoveredEntity] = useState<{
    lineId: number;
    entityId: bigint;
    rightNeighbor: bigint;
  } | null>(null);

  return (
    <div
      className="disableScrollBar"
      style={
        {
          marginTop: "32px",
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
          justifyContent: "flex-start",
          alignItems: "center",
          width: "100%",
          height: `calc(100vh - 109px)`, // paddingTop(32px) + logoBarHeight(45px) + logoBarPaddingTop(32px)
          "--line-thickness": `${3 * scale}px`,
        } as React.CSSProperties
      }
      ref={containerRef}
    >
      {
        lines.reduce(
          (acc, line, i) => {
            const lineId = line[0].lineId;

            const lineHeight = 100 * scale;
            const marginBottom = 25 * scale;

            const { isVisible, isOnlyPartiallyVisible } =
              calculateLineVisibility(
                acc.totalHeight,
                (acc.totalHeight += lineHeight + marginBottom),
                containerRef.current?.clientHeight ?? 0,
                containerRef.current?.scrollTop ?? 0
              );

            acc.elements.push(
              <div
                key={lineId}
                id={`line-${lineId}`}
                onClick={() => onLineClick?.(lineId)}
                style={{ cursor: onLineClick ? "pointer" : undefined }}
              >
                <div
                  style={{
                    width: `${configLineWidth * scale}px`,
                    marginBottom: `${marginBottom}px`,
                    height: `${lineHeight}px`,
                    visibility: isVisible ? "visible" : "hidden",

                    // Don't fade out the first and last lines. This is done because
                    // isElementInViewport is kinda glitchy for the first & last lines.
                    ...(isOnlyPartiallyVisible &&
                    i !== 0 &&
                    i !== lines.length - 1
                      ? { opacity: 0.5 }
                      : {}),

                    transition: `opacity 250ms`,
                  }}
                  {...(isVisible ? { className: "lineContainer" } : {})}
                >
                  {isVisible && (
                    <div
                      className="line"
                      style={{ minHeight: `${lineHeight}px` }}
                    >
                      <>
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            zIndex: 10,
                            color: "white",
                            fontSize: `${12 * scale}px`,
                            fontWeight: "bold",
                            textShadow: `${1 * scale}px ${1 * scale}px ${2 * scale}px black`,
                          }}
                        >
                          {lineId}
                        </div>

                        {line.map((entity) => {
                          const eid = entity.entityId;

                          const diameter =
                            computeDiameter(entity).fromWad() * scale;
                          const height =
                            entity.etype == EntityType.WALL
                              ? lineHeight
                              : diameter;

                          const username =
                            entity.etype === EntityType.ALIVE
                              ? gameState.usernames.get(entity.entityId)
                              : null;

                          let sizeClass;

                          if (
                            isPoweredUp(
                              entity,
                              lastProcessedTime,
                              gameConfig.powerPelletEffectTime
                            )
                          ) {
                            sizeClass = "big"; // If the entity is powered up, they're automatically "big"
                          } else {
                            const postJumpDecayMass =
                              computeMassAfterJumpingLine(
                                entity.mass,
                                gameConfig.lineJumpDecayFactor
                              );
                            sizeClass =
                              postJumpDecayMass >=
                              4n * gameConfig.playerStartingMass
                                ? "big"
                                : postJumpDecayMass >=
                                    2n * gameConfig.playerStartingMass
                                  ? "medium"
                                  : "small";
                          }

                          // Colors via: https://berkeleygraphics.com/typefaces/berkeley-mono/
                          const color =
                            entity.etype == EntityType.POWER_PELLET
                              ? "#FF00FF"
                              : entity.etype == EntityType.FOOD
                                ? "#00BCFF"
                                : entity.etype == EntityType.WALL
                                  ? "#FF5700"
                                  : sizeClass === "big"
                                    ? "#FF5700"
                                    : sizeClass === "medium"
                                      ? "#FFC000"
                                      : "#00E893";

                          // Boundary entities are an implementation detail.
                          if (isBoundaryEntity(eid)) return null;

                          return (
                            <div
                              key={eid.toString()}
                              id={eid.toString()}
                              className={`entity ${entity.etype == EntityType.WALL ? "wall" : ""}`}
                              style={{
                                background: color,
                                width: `${diameter}px`,
                                height: `${height}px`,
                                left: `${
                                  computeX(
                                    entity,
                                    lastProcessedTime,
                                    gameConfig.velocityCoefficient
                                  ).fromWad() * scale
                                }px`,
                                animation: isPoweredUp(
                                  entity,
                                  lastProcessedTime,
                                  gameConfig.powerPelletEffectTime
                                )
                                  ? `${colorToGlowClass(color)} ${(
                                      (1 -
                                        (
                                          lastProcessedTime -
                                          entity.lastConsumedPowerPelletTime
                                        )
                                          .divWad(
                                            gameConfig.powerPelletEffectTime
                                          )
                                          .fromWad()) *
                                        0.4 +
                                      0.1
                                    ).toFixed(1)}s infinite`
                                  : entity.etype == EntityType.POWER_PELLET
                                    ? `${colorToGlowClass(color)} 0.5s infinite`
                                    : "none",
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                position: "relative",
                              }}
                              onMouseEnter={() =>
                                setHoveredEntity({
                                  lineId,
                                  entityId: entity.entityId,
                                  rightNeighbor: entity.rightNeighbor,
                                })
                              }
                              onMouseLeave={() =>
                                setHoveredEntity((h) =>
                                  h && h.entityId === entity.entityId ? null : h
                                )
                              }
                            >
                              {/* Spawn arrows on hover */}
                              {hoveredEntity &&
                                hoveredEntity.entityId === entity.entityId &&
                                onSpawnRequest && (
                                  <div
                                    style={{
                                      position: "absolute",
                                      top: "-18px",
                                      left: 0,
                                      width: "100%",
                                      display: "flex",
                                      justifyContent: "space-between",
                                      pointerEvents: "auto",
                                      zIndex: 200,
                                    }}
                                  >
                                    <span
                                      style={{
                                        cursor: "pointer",
                                        fontSize: 18,
                                        color: "#00E893",
                                        background: "#181818",
                                        borderRadius: 4,
                                        padding: "0 4px",
                                      }}
                                      title="Spawn to the left"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onSpawnRequest(
                                          lineId,
                                          entity.entityId,
                                          false
                                        );
                                      }}
                                    >
                                      ←
                                    </span>
                                    <span
                                      style={{
                                        cursor: "pointer",
                                        fontSize: 18,
                                        color: "#00E893",
                                        background: "#181818",
                                        borderRadius: 4,
                                        padding: "0 4px",
                                      }}
                                      title="Spawn to the right"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onSpawnRequest(
                                          lineId,
                                          entity.rightNeighbor,
                                          true
                                        );
                                      }}
                                    >
                                      →
                                    </span>
                                  </div>
                                )}

                              {DEBUG_ITER != null || DEBUG_EMOJI != null ? (
                                <div
                                  style={{
                                    position: "absolute",
                                    zIndex: 100,
                                    fontSize: "13px",
                                    fontWeight: "bold",
                                    textShadow: "1px 1px 2px black",
                                    color: "#FF5700",
                                  }}
                                >
                                  {mapEntityToEmoji(eid)}{" "}
                                  {DEBUG_ITER != null
                                    ? (() => {
                                        const velocity = computeVelocity(
                                          entity,
                                          gameConfig.velocityCoefficient
                                        ).fromWad();

                                        return velocity > 0 ? `→` : `←`;
                                      })()
                                    : null}
                                </div>
                              ) : null}

                              {username && (
                                <div
                                  style={{
                                    position: "absolute",
                                    zIndex: 100,
                                    color: "white",
                                    fontSize: `${12 * scale}px`,
                                    fontWeight: "bold",
                                    textShadow: `${1 * scale}px ${1 * scale}px ${2 * scale}px black`,
                                  }}
                                >
                                  {username}
                                </div>
                              )}

                              <div
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  display: "flex",
                                  justifyContent: "center",
                                  alignItems: "center",
                                }}
                              >
                                {entity.etype === EntityType.ALIVE ? (
                                  sizeClass === "big" ? (
                                    <BigCrab />
                                  ) : sizeClass === "medium" ? (
                                    <MediumCrab />
                                  ) : (
                                    <SmallCrab />
                                  )
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    </div>
                  )}
                </div>

                {DEBUG_ITER != null && (
                  <DebugPanel
                    lastProcessedTime={lastProcessedTime}
                    line={line}
                    lineState={lineStates[i]}
                    gameConfig={gameConfig}
                  />
                )}
              </div>
            );

            return acc;
          },
          { elements: [] as React.ReactNode[], totalHeight: 0 }
        ).elements
      }
    </div>
  );
}
