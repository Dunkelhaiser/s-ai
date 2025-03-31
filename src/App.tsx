import React, { useEffect, useRef, useState } from "react";
import { CITY_COORDINATES, Connections, parseData } from "./data";
import mapImageUrl from "./Map.png";
import CreateNodeDialog from "./components/CreateNodeDialog";
import AddEdgeDialog from "./components/AddEdgeDialog";
import { Button } from "./components/ui/button";
import { Label } from "./components/ui/label";
import { Input } from "./components/ui/input";
import AddingEdgePopup from "./components/AddingEdgePopup";

interface GraphNode {
    id: string;
    x: number;
    y: number;
    radius: number;
    color: string;
    name: string;
}

interface GraphLink {
    source: string;
    target: string;
    distance: number;
    directed?: boolean;
}

interface PathResult {
    path: string[];
    totalDistance: number;
}

interface AnimationStep {
    currentNode: string;
    visitedEdge: { source: string; target: string } | null;
    currentPath: string[];
    isBacktrack: boolean;
    waveNodes?: string[];
    waveEdges?: { source: string; target: string }[];
    nextWaveNodes?: string[];
    waveNumber?: number;
    isBackwardWave?: boolean;
}

const App = () => {
    const [cities, setCities] = useState<string[]>([]);
    const [connections, setConnections] = useState<Connections[]>([]);
    const [nodes, setNodes] = useState<GraphNode[]>([]);
    const [links, setLinks] = useState<GraphLink[]>([]);
    const [selectedCity, setSelectedCity] = useState<string | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [hoveredCity, setHoveredCity] = useState<string | null>(null);
    const [hoveredEdge, setHoveredEdge] = useState<{ source: string; target: string } | null>(null);
    const [mapImage, setMapImage] = useState<HTMLImageElement | null>(null);
    const [connectedCities, setConnectedCities] = useState<Set<string>>(new Set());
    const [time, setTime] = useState<number>(0);
    const [algorithm, setAlgorithm] = useState<"DFS" | "BFS" | "Dijkstra" | "Wave" | "BidirectionalWave">("DFS");

    const [startCity, setStartCity] = useState<string>("");
    const [endCity, setEndCity] = useState<string>("");
    const [dfsPath, setDfsPath] = useState<PathResult | null>(null);
    const [pathNodes, setPathNodes] = useState<Set<string>>(new Set());
    const [pathEdges, setPathEdges] = useState<Set<string>>(new Set());
    const [reverseTraversal, setReverseTraversal] = useState<boolean>(false);

    const [animationSteps, setAnimationSteps] = useState<AnimationStep[]>([]);
    const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);
    const [isAnimating, setIsAnimating] = useState<boolean>(false);
    const [animationSpeed, setAnimationSpeed] = useState<number>(500); // ms
    const animationRef = useRef<number | null>(null);
    const [currentNode, setCurrentNode] = useState<string | null>(null);
    const [currentEdge, setCurrentEdge] = useState<{ source: string; target: string } | null>(null);
    const [visitedNodes, setVisitedNodes] = useState<Set<string>>(new Set());
    const [visitedEdges, setVisitedEdges] = useState<Set<string>>(new Set());
    const [currentPathAnimation, setCurrentPathAnimation] = useState<string[]>([]);
    const [isBacktracking, setIsBacktracking] = useState<boolean>(false);

    const [isCreatingNode, setIsCreatingNode] = useState<boolean>(false);
    const [newNodePosition, setNewNodePosition] = useState<{ x: number; y: number } | null>(null);
    const [isConnectingNodes, setIsConnectingNodes] = useState<boolean>(false);
    const [sourceNodeId, setSourceNodeId] = useState<string | null>(null);
    const [isCreatingEdge, setIsCreatingEdge] = useState<boolean>(false);
    const [edgeSource, setEdgeSource] = useState<string>("");
    const [edgeTarget, setEdgeTarget] = useState<string>("");
    const [edgeToWaveMap, setEdgeToWaveMap] = useState<Map<string, { number: number; isBackward: boolean }>>(new Map());

    useEffect(() => {
        const data = parseData();
        setCities(data.cities);
        setConnections(data.connections);

        const img = new Image();
        img.src = mapImageUrl;
        img.onload = () => {
            setMapImage(img);
        };
    }, []);

    useEffect(() => {
        if (cities.length === 0 || connections.length === 0) return;

        const cityNodes: GraphNode[] = cities.map((city) => {
            const [x, y] = CITY_COORDINATES[city];
            return {
                id: city,
                x,
                y,
                radius: 6,
                color: "#3498db",
                name: city,
            };
        });

        const cityLinks: GraphLink[] = connections.map((connection) => ({
            source: connection.city1,
            target: connection.city2,
            distance: connection.distance,
            directed: connection.directed,
        }));

        setNodes(cityNodes);
        setLinks(cityLinks);

        setStartCity(cities[0]);
        setEndCity(cities[cities.length - 1]);
    }, [cities, connections]);

    // Update connected cities when selection changes
    useEffect(() => {
        if (selectedCity) {
            const connected = new Set<string>();

            links.forEach((link) => {
                if (link.source === selectedCity) {
                    connected.add(link.target);
                } else if (link.target === selectedCity) {
                    connected.add(link.source);
                }
            });

            setConnectedCities(connected);
        } else {
            setConnectedCities(new Set());
        }
    }, [selectedCity, links]);

    const reconstructCurrentPath = (previous: Record<string, string | null>, current: string): string[] => {
        const path: string[] = [];
        let currentNode: string | null = current;

        while (currentNode) {
            path.unshift(currentNode);
            currentNode = previous[currentNode];
            if (!currentNode) break;
        }

        return path;
    };

    const buildAdjacencyList = () => {
        const adjacencyList: Record<string, { city: string; distance: number }[]> = {};

        cities.forEach((city) => {
            adjacencyList[city] = [];
        });

        links.forEach((link) => {
            if (reverseTraversal) {
                if (link.directed) {
                    adjacencyList[link.target].push({ city: link.source, distance: link.distance });
                } else {
                    adjacencyList[link.source].push({ city: link.target, distance: link.distance });
                    adjacencyList[link.target].push({ city: link.source, distance: link.distance });
                }
            } else {
                adjacencyList[link.source].push({ city: link.target, distance: link.distance });

                if (!link.directed) {
                    adjacencyList[link.target].push({ city: link.source, distance: link.distance });
                }
            }
        });

        return adjacencyList;
    };

    const performDFS = () => {
        const start = performance.now();
        if (!startCity || !endCity || startCity === endCity) {
            setDfsPath(null);
            setPathNodes(new Set());
            setPathEdges(new Set());
            setAnimationSteps([]);
            setCurrentStepIndex(-1);
            resetAnimationState();
            return;
        }

        const adjacencyList = buildAdjacencyList();
        const visited = new Set<string>();
        const pathStack: string[] = [];
        const distanceMap: Record<string, number> = {};
        const animSteps: AnimationStep[] = [];

        cities.forEach((city) => {
            distanceMap[city] = 0;
        });

        const dfs = (current: string, target: string, currentPath: string[], currentDistance: number): boolean => {
            if (current === target) {
                pathStack.push(...currentPath, current);
                return true;
            }

            visited.add(current);
            animSteps.push({
                currentNode: current,
                visitedEdge: null,
                currentPath: [...currentPath],
                isBacktrack: false,
            });

            currentPath.push(current);

            const neighbors = [...adjacencyList[current]];
            if (reverseTraversal) {
                neighbors.reverse();
            }

            for (const neighbor of neighbors) {
                if (!visited.has(neighbor.city)) {
                    animSteps.push({
                        currentNode: current,
                        visitedEdge: { source: current, target: neighbor.city },
                        currentPath: [...currentPath],
                        isBacktrack: false,
                    });

                    const tempDistance = currentDistance + neighbor.distance;
                    distanceMap[neighbor.city] = tempDistance;

                    if (dfs(neighbor.city, target, currentPath, tempDistance)) {
                        return true;
                    }
                }
            }

            animSteps.push({
                currentNode: current,
                visitedEdge: null,
                currentPath: [...currentPath],
                isBacktrack: true,
            });

            currentPath.pop();
            return false;
        };

        dfs(startCity, endCity, [], 0);

        if (pathStack.length > 0) {
            const nodes = new Set<string>();
            const edges = new Set<string>();

            for (let i = 0; i < pathStack.length; i++) {
                nodes.add(pathStack[i]);

                if (i < pathStack.length - 1) {
                    const source = pathStack[i];
                    const target = pathStack[i + 1];
                    edges.add(`${source}-${target}`);
                    edges.add(`${target}-${source}`);
                }
            }

            setPathNodes(nodes);
            setPathEdges(edges);
            setDfsPath({
                path: pathStack,
                totalDistance: distanceMap[endCity],
            });

            setAnimationSteps(animSteps);
            setCurrentStepIndex(-1);
            resetAnimationState();
        } else {
            setDfsPath(null);
            setPathNodes(new Set());
            setPathEdges(new Set());
            setAnimationSteps([]);
            setCurrentStepIndex(-1);
            resetAnimationState();
        }
        const end = performance.now();
        setTime(end - start);
    };

    const performBFS = () => {
        const start = performance.now();
        if (!startCity || !endCity || startCity === endCity) {
            setDfsPath(null);
            setPathNodes(new Set());
            setPathEdges(new Set());
            setAnimationSteps([]);
            setCurrentStepIndex(-1);
            resetAnimationState();
            return;
        }

        const adjacencyList = buildAdjacencyList();
        const visited = new Set<string>();
        const queue: { node: string; path: string[]; distance: number }[] = [];
        const animSteps: AnimationStep[] = [];

        queue.push({ node: startCity, path: [], distance: 0 });
        visited.add(startCity);

        animSteps.push({
            currentNode: startCity,
            visitedEdge: null,
            currentPath: [],
            isBacktrack: false,
        });

        while (queue.length > 0) {
            const { node, path, distance } = queue.shift()!;
            const currentPath = [...path, node];

            if (node === endCity) {
                const pathNodes = new Set<string>(currentPath);
                const pathEdges = new Set<string>();

                for (let i = 0; i < currentPath.length - 1; i++) {
                    const source = currentPath[i];
                    const target = currentPath[i + 1];
                    pathEdges.add(`${source}-${target}`);
                    pathEdges.add(`${target}-${source}`);
                }

                setPathNodes(pathNodes);
                setPathEdges(pathEdges);
                setDfsPath({
                    path: currentPath,
                    totalDistance: distance,
                });

                setAnimationSteps(animSteps);
                setCurrentStepIndex(-1);
                resetAnimationState();

                const end = performance.now();
                setTime(end - start);
                return;
            }

            const neighbors = [...adjacencyList[node]];
            if (reverseTraversal) {
                neighbors.reverse();
            }

            for (const neighbor of neighbors) {
                if (!visited.has(neighbor.city)) {
                    visited.add(neighbor.city);

                    animSteps.push({
                        currentNode: node,
                        visitedEdge: { source: node, target: neighbor.city },
                        currentPath: [...currentPath],
                        isBacktrack: false,
                    });

                    animSteps.push({
                        currentNode: neighbor.city,
                        visitedEdge: null,
                        currentPath: [...currentPath],
                        isBacktrack: false,
                    });

                    queue.push({
                        node: neighbor.city,
                        path: currentPath,
                        distance: distance + neighbor.distance,
                    });
                }
            }
        }

        setDfsPath(null);
        setPathNodes(new Set());
        setPathEdges(new Set());
        setAnimationSteps([]);
        setCurrentStepIndex(-1);
        resetAnimationState();
        const end = performance.now();
        setTime(end - start);
    };

    const performDijkstra = () => {
        const start = performance.now();
        if (!startCity || !endCity || startCity === endCity) {
            setDfsPath(null);
            setPathNodes(new Set());
            setPathEdges(new Set());
            setAnimationSteps([]);
            setCurrentStepIndex(-1);
            resetAnimationState();
            return;
        }

        const adjacencyList = buildAdjacencyList();
        const distances: Record<string, number> = {};
        const previous: Record<string, string | null> = {};
        const unvisited = new Set<string>();
        const animSteps: AnimationStep[] = [];

        cities.forEach((city) => {
            distances[city] = city === startCity ? 0 : Infinity;
            previous[city] = null;
            unvisited.add(city);
        });

        animSteps.push({
            currentNode: startCity,
            visitedEdge: null,
            currentPath: [],
            isBacktrack: false,
        });

        while (unvisited.size > 0) {
            let current: string | null = null;
            let minDistance = Infinity;

            unvisited.forEach((city) => {
                if (distances[city] < minDistance) {
                    minDistance = distances[city];
                    current = city;
                }
            });

            if (current === null || distances[current] === Infinity) {
                break;
            }

            if (current === endCity) {
                break;
            }

            unvisited.delete(current);

            adjacencyList[current].forEach((neighbor) => {
                if (!unvisited.has(neighbor.city) || !current) return;

                const potentialDistance = distances[current] + neighbor.distance;

                animSteps.push({
                    currentNode: current!,
                    visitedEdge: { source: current!, target: neighbor.city },
                    currentPath: reconstructCurrentPath(previous, current!),
                    isBacktrack: false,
                });

                if (potentialDistance < distances[neighbor.city]) {
                    distances[neighbor.city] = potentialDistance;
                    previous[neighbor.city] = current;

                    animSteps.push({
                        currentNode: neighbor.city,
                        visitedEdge: null,
                        currentPath: reconstructCurrentPath(previous, neighbor.city),
                        isBacktrack: false,
                    });
                }
            });
        }

        const path: string[] = [];
        let current = endCity;

        if (previous[endCity] !== null || startCity === endCity) {
            while (current) {
                path.unshift(current);
                current = previous[current]!;
                if (!current) break;
            }

            const nodes = new Set<string>(path);
            const edges = new Set<string>();

            for (let i = 0; i < path.length - 1; i++) {
                const source = path[i];
                const target = path[i + 1];
                edges.add(`${source}-${target}`);
                edges.add(`${target}-${source}`);
            }

            setPathNodes(nodes);
            setPathEdges(edges);
            setDfsPath({
                path,
                totalDistance: distances[endCity],
            });

            setAnimationSteps(animSteps);
            setCurrentStepIndex(-1);
            resetAnimationState();
        } else {
            setDfsPath(null);
            setPathNodes(new Set());
            setPathEdges(new Set());
            setAnimationSteps([]);
            setCurrentStepIndex(-1);
            resetAnimationState();
        }

        const end = performance.now();
        setTime(end - start);
    };

    const performWave = () => {
        const start = performance.now();
        let waveCounter = 0;

        if (!startCity || !endCity || startCity === endCity) {
            setDfsPath(null);
            setPathNodes(new Set());
            setPathEdges(new Set());
            setAnimationSteps([]);
            setCurrentStepIndex(-1);
            resetAnimationState();
            return;
        }

        const adjacencyList = buildAdjacencyList();
        const visited = new Set<string>();
        const previous: Record<string, string | null> = {};
        const distances: Record<string, number> = {};
        const animSteps: AnimationStep[] = [];

        cities.forEach((city) => {
            previous[city] = null;
            distances[city] = city === startCity ? 0 : Infinity;
        });

        const queue: string[] = [startCity];
        visited.add(startCity);

        animSteps.push({
            currentNode: startCity,
            visitedEdge: null,
            currentPath: [],
            isBacktrack: false,
        });

        let foundPath = false;

        while (queue.length > 0 && !foundPath) {
            const waveSize = queue.length;
            const currentWave = [];
            const currentPaths = [];

            for (let i = 0; i < waveSize; i++) {
                const current = queue.shift()!;
                currentWave.push(current);
                currentPaths.push(reconstructCurrentPath(previous, current));

                if (current === endCity) {
                    foundPath = true;
                    break;
                }
            }

            const waveEdges: { source: string; target: string }[] = [];
            const nextWaveNodes: string[] = [];

            for (const current of currentWave) {
                const neighbors = [...adjacencyList[current]];
                if (reverseTraversal) {
                    neighbors.reverse();
                }

                for (const neighbor of neighbors) {
                    if (!visited.has(neighbor.city)) {
                        visited.add(neighbor.city);
                        previous[neighbor.city] = current;
                        distances[neighbor.city] = distances[current] + neighbor.distance;

                        waveEdges.push({ source: current, target: neighbor.city });
                        nextWaveNodes.push(neighbor.city);

                        queue.push(neighbor.city);
                    }
                }
            }

            if (waveEdges.length > 0) {
                const compositePath = currentWave.length > 0 ? reconstructCurrentPath(previous, currentWave[0]) : [];

                animSteps.push({
                    currentNode: currentWave.length > 0 ? currentWave[0] : "",
                    visitedEdge: waveEdges[0],
                    currentPath: compositePath,
                    isBacktrack: false,
                    waveNodes: currentWave,
                    waveEdges: waveEdges,
                    nextWaveNodes: nextWaveNodes,
                    waveNumber: waveCounter++,
                });
            }
        }

        if (foundPath) {
            const path = reconstructCurrentPath(previous, endCity);

            const nodes = new Set<string>(path);
            const edges = new Set<string>();

            for (let j = 0; j < path.length - 1; j++) {
                const source = path[j];
                const target = path[j + 1];
                edges.add(`${source}-${target}`);
                edges.add(`${target}-${source}`);
            }

            setPathNodes(nodes);
            setPathEdges(edges);
            setDfsPath({
                path,
                totalDistance: distances[endCity],
            });

            setAnimationSteps(animSteps);
            setCurrentStepIndex(-1);
            resetAnimationState();
        } else {
            setDfsPath(null);
            setPathNodes(new Set());
            setPathEdges(new Set());
            setAnimationSteps([]);
            setCurrentStepIndex(-1);
            resetAnimationState();
        }

        const end = performance.now();
        setTime(end - start);
    };

    const performBidirectionalWave = () => {
        const start = performance.now();
        let forwardWaveCounter = 0;
        let backwardWaveCounter = 0;

        if (!startCity || !endCity || startCity === endCity) {
            setDfsPath(null);
            setPathNodes(new Set());
            setPathEdges(new Set());
            setAnimationSteps([]);
            setCurrentStepIndex(-1);
            resetAnimationState();
            return;
        }

        const adjacencyList = buildAdjacencyList();

        const visitedForward = new Set<string>([startCity]);
        const visitedBackward = new Set<string>([endCity]);

        const previousForward: Record<string, string | null> = {};
        const previousBackward: Record<string, string | null> = {};
        const distancesForward: Record<string, number> = {};
        const distancesBackward: Record<string, number> = {};

        cities.forEach((city) => {
            previousForward[city] = null;
            previousBackward[city] = null;
            distancesForward[city] = city === startCity ? 0 : Infinity;
            distancesBackward[city] = city === endCity ? 0 : Infinity;
        });

        const queueForward: string[] = [startCity];
        const queueBackward: string[] = [endCity];

        const animSteps: AnimationStep[] = [];

        animSteps.push({
            currentNode: startCity,
            visitedEdge: null,
            currentPath: [startCity],
            isBacktrack: false,
            waveNodes: [startCity],
            waveEdges: [],
            nextWaveNodes: [],
        });

        animSteps.push({
            currentNode: endCity,
            visitedEdge: null,
            currentPath: [endCity],
            isBacktrack: false,
            waveNodes: [endCity],
            waveEdges: [],
            nextWaveNodes: [],
        });

        let meetingNode: string | null = null;
        let foundPath = false;

        while ((queueForward.length > 0 || queueBackward.length > 0) && !foundPath) {
            if (queueForward.length > 0) {
                const waveSizeForward = queueForward.length;
                const currentWaveForward: string[] = [];

                for (let i = 0; i < waveSizeForward; i++) {
                    const current = queueForward.shift()!;
                    currentWaveForward.push(current);

                    if (visitedBackward.has(current)) {
                        meetingNode = current;
                        foundPath = true;
                        break;
                    }
                }

                if (foundPath) break;

                const waveEdgesForward: { source: string; target: string }[] = [];
                const nextWaveNodesForward: string[] = [];

                for (const current of currentWaveForward) {
                    const neighbors = [...adjacencyList[current]];
                    if (reverseTraversal) {
                        neighbors.reverse();
                    }

                    for (const neighbor of neighbors) {
                        if (!visitedForward.has(neighbor.city)) {
                            visitedForward.add(neighbor.city);
                            previousForward[neighbor.city] = current;
                            distancesForward[neighbor.city] = distancesForward[current] + neighbor.distance;

                            waveEdgesForward.push({ source: current, target: neighbor.city });
                            nextWaveNodesForward.push(neighbor.city);

                            queueForward.push(neighbor.city);

                            if (visitedBackward.has(neighbor.city)) {
                                meetingNode = neighbor.city;
                                foundPath = true;
                                break;
                            }
                        }
                    }

                    if (foundPath) break;
                }

                if (waveEdgesForward.length > 0) {
                    animSteps.push({
                        currentNode: "",
                        visitedEdge: null,
                        currentPath: [],
                        isBacktrack: false,
                        waveNodes: currentWaveForward,
                        waveEdges: waveEdgesForward,
                        nextWaveNodes: nextWaveNodesForward,
                        waveNumber: forwardWaveCounter++,
                    });
                }
            }

            if (foundPath) break;

            if (queueBackward.length > 0) {
                const waveSizeBackward = queueBackward.length;
                const currentWaveBackward: string[] = [];

                for (let i = 0; i < waveSizeBackward; i++) {
                    const current = queueBackward.shift()!;
                    currentWaveBackward.push(current);

                    if (visitedForward.has(current)) {
                        meetingNode = current;
                        foundPath = true;
                        break;
                    }
                }

                if (foundPath) break;

                const waveEdgesBackward: { source: string; target: string }[] = [];
                const nextWaveNodesBackward: string[] = [];

                for (const current of currentWaveBackward) {
                    const neighbors = [...adjacencyList[current]];
                    if (reverseTraversal) {
                        neighbors.reverse();
                    }

                    for (const neighbor of neighbors) {
                        if (!visitedBackward.has(neighbor.city)) {
                            visitedBackward.add(neighbor.city);
                            previousBackward[neighbor.city] = current;
                            distancesBackward[neighbor.city] = distancesBackward[current] + neighbor.distance;

                            waveEdgesBackward.push({ source: current, target: neighbor.city });
                            nextWaveNodesBackward.push(neighbor.city);

                            queueBackward.push(neighbor.city);

                            if (visitedForward.has(neighbor.city)) {
                                meetingNode = neighbor.city;
                                foundPath = true;
                                break;
                            }
                        }
                    }

                    if (foundPath) break;
                }

                if (waveEdgesBackward.length > 0) {
                    animSteps.push({
                        currentNode: "",
                        visitedEdge: null,
                        currentPath: [],
                        isBacktrack: false,
                        waveNodes: currentWaveBackward,
                        waveEdges: waveEdgesBackward,
                        nextWaveNodes: nextWaveNodesBackward,
                        waveNumber: backwardWaveCounter++,
                        isBackwardWave: true, // Add a flag to distinguish between forward and backward waves
                    });
                }
            }
        }

        if (foundPath && meetingNode) {
            const forwardPath: string[] = [];
            let current: string | null = meetingNode;

            while (current) {
                forwardPath.unshift(current);
                current = previousForward[current]!;
                if (!current) break;
            }

            const backwardPath: string[] = [];
            current = previousBackward[meetingNode];

            while (current) {
                backwardPath.push(current);
                current = previousBackward[current]!;
                if (!current) break;
            }

            const fullPath = forwardPath.concat(backwardPath);

            let totalDistance = 0;
            for (let i = 0; i < fullPath.length - 1; i++) {
                const source = fullPath[i];
                const target = fullPath[i + 1];

                const link = links.find(
                    (l) => (l.source === source && l.target === target) || (l.source === target && l.target === source)
                );

                if (link) {
                    totalDistance += link.distance;
                }
            }

            animSteps.push({
                currentNode: meetingNode,
                visitedEdge: null,
                currentPath: [],
                isBacktrack: false,
                waveNodes: [meetingNode],
                waveEdges: [],
                nextWaveNodes: [],
            });

            animSteps.push({
                currentNode: "",
                visitedEdge: null,
                currentPath: fullPath,
                isBacktrack: false,
                waveNodes: [],
                waveEdges: [],
                nextWaveNodes: [],
            });

            const nodes = new Set<string>(fullPath);
            const edges = new Set<string>();

            for (let i = 0; i < fullPath.length - 1; i++) {
                const source = fullPath[i];
                const target = fullPath[i + 1];
                edges.add(`${source}-${target}`);
                edges.add(`${target}-${source}`);
            }

            setPathNodes(nodes);
            setPathEdges(edges);
            setDfsPath({
                path: fullPath,
                totalDistance: totalDistance,
            });

            setAnimationSteps(animSteps);
            setCurrentStepIndex(-1);
            resetAnimationState();
        } else {
            setDfsPath(null);
            setPathNodes(new Set());
            setPathEdges(new Set());
            setAnimationSteps([]);
            setCurrentStepIndex(-1);
            resetAnimationState();
        }

        const end = performance.now();
        setTime(end - start);
    };

    const findPath = () => {
        if (algorithm === "DFS") {
            performDFS();
        } else if (algorithm === "BFS") {
            performBFS();
        } else if (algorithm === "Dijkstra") {
            performDijkstra();
        } else if (algorithm === "Wave") {
            performWave();
        } else if (algorithm === "BidirectionalWave") {
            performBidirectionalWave();
        }
    };

    const resetAnimationState = () => {
        setCurrentNode(null);
        setCurrentEdge(null);
        setVisitedNodes(new Set());
        setVisitedEdges(new Set());
        setCurrentPathAnimation([]);
        setIsBacktracking(false);
        setEdgeToWaveMap(new Map()); // Reset the edge-to-wave map
        stopAnimation();
    };

    const startAnimation = () => {
        if (animationSteps.length === 0) {
            return;
        }

        setIsAnimating(true);
        setCurrentStepIndex(0);
    };

    const stopAnimation = () => {
        if (animationRef.current !== null) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }
        setIsAnimating(false);
    };

    // Animation frame handling
    useEffect(() => {
        if (isAnimating && currentStepIndex >= 0 && currentStepIndex < animationSteps.length) {
            setPathNodes(new Set());
            const timeoutId = setTimeout(() => {
                const step = animationSteps[currentStepIndex];

                if (step.waveNodes && step.waveEdges) {
                    setEdgeToWaveMap((prev) => {
                        const updated = new Map(prev);
                        step.waveEdges?.forEach((edge) => {
                            const edgeKey1 = `${edge.source}-${edge.target}`;
                            const edgeKey2 = `${edge.target}-${edge.source}`;
                            updated.set(edgeKey1, {
                                number: step.waveNumber!,
                                isBackward: !!step.isBackwardWave,
                            });
                            updated.set(edgeKey2, {
                                number: step.waveNumber!,
                                isBackward: !!step.isBackwardWave,
                            });
                        });
                        return updated;
                    });

                    setVisitedNodes((prev) => {
                        const updated = new Set(prev);
                        step.waveNodes?.forEach((node) => updated.add(node));
                        return updated;
                    });

                    setVisitedEdges((prev) => {
                        const updated = new Set(prev);
                        step.waveEdges?.forEach((edge) => {
                            updated.add(`${edge.source}-${edge.target}`);
                            updated.add(`${edge.target}-${edge.source}`);
                        });
                        return updated;
                    });

                    setCurrentNode(null);

                    setCurrentEdge(null);
                } else {
                    setCurrentNode(step.currentNode);

                    setVisitedNodes((prev) => {
                        const updated = new Set(prev);
                        updated.add(step.currentNode);
                        return updated;
                    });

                    if (step.visitedEdge) {
                        setCurrentEdge(step.visitedEdge);

                        setVisitedEdges((prev) => {
                            const updated = new Set(prev);
                            updated.add(`${step.visitedEdge!.source}-${step.visitedEdge!.target}`);
                            updated.add(`${step.visitedEdge!.target}-${step.visitedEdge!.source}`);
                            return updated;
                        });
                    } else {
                        setCurrentEdge(null);
                    }
                }

                setCurrentPathAnimation(step.currentPath);
                if (step.currentPath.length > 0) {
                    const pathEdgesInAnimation = new Set<string>();
                    for (let i = 0; i < step.currentPath.length - 1; i++) {
                        const source = step.currentPath[i];
                        const target = step.currentPath[i + 1];
                        pathEdgesInAnimation.add(`${source}-${target}`);
                        pathEdgesInAnimation.add(`${target}-${source}`);
                    }

                    if (step.visitedEdge) {
                        pathEdgesInAnimation.add(`${step.visitedEdge.source}-${step.visitedEdge.target}`);
                        pathEdgesInAnimation.add(`${step.visitedEdge.target}-${step.visitedEdge.source}`);
                    }

                    setPathEdges(pathEdgesInAnimation);
                }

                setIsBacktracking(step.isBacktrack);

                setCurrentStepIndex((prev) => prev + 1);
            }, animationSpeed);

            return () => clearTimeout(timeoutId);
        } else if (isAnimating && currentStepIndex >= animationSteps.length) {
            setIsAnimating(false);
            findPath();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAnimating, currentStepIndex, animationSteps, animationSpeed]);

    useEffect(() => {
        if (!canvasRef.current || nodes.length === 0 || links.length === 0) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = 800;
        canvas.height = 500;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);

        if (mapImage) {
            ctx.drawImage(mapImage, 0, 0, canvas.width, canvas.height);
        }

        // Draw connections
        links.forEach((link) => {
            const source = nodes.find((n) => n.id === link.source);
            const target = nodes.find((n) => n.id === link.target);

            if (source && target) {
                ctx.beginPath();
                ctx.moveTo(source.x, source.y);
                ctx.lineTo(target.x, target.y);

                const maxDistance = Math.max(...links.map((l) => l.distance));

                const opacity = 1 - (link.distance / maxDistance) * 0.8;

                const isCurrentEdge =
                    currentEdge &&
                    ((currentEdge.source === link.source && currentEdge.target === link.target) ||
                        (currentEdge.target === link.source && currentEdge.source === link.target));

                const edgeKey1 = `${link.source}-${link.target}`;
                const edgeKey2 = `${link.target}-${link.source}`;
                const isVisitedEdge = visitedEdges.has(edgeKey1) || visitedEdges.has(edgeKey2);

                const isFinalPathEdge =
                    pathEdges.has(`${link.source}-${link.target}`) || pathEdges.has(`${link.target}-${link.source}`);

                const waveNumber = edgeToWaveMap.get(edgeKey1) || edgeToWaveMap.get(edgeKey2);
                const waveInfo = edgeToWaveMap.get(edgeKey1) || edgeToWaveMap.get(edgeKey2)!;

                if (isVisitedEdge && waveNumber !== undefined) {
                    const forwardWaveColors = [
                        "rgba(255, 0, 0, 0.7)", // Red
                        "rgba(255, 165, 0, 0.7)", // Orange
                        "rgba(255, 255, 0, 0.7)", // Yellow
                        "rgba(0, 0, 255, 0.7)", // Blue
                        "rgba(220, 20, 60, 0.7)", // Crimson
                        "rgba(255, 215, 0, 0.7)", // Gold
                    ];

                    const backwardWaveColors = [
                        "rgba(255, 105, 180, 0.7)", // Pink
                        "rgba(0, 255, 255, 0.7)", // Cyan
                        "rgba(75, 0, 130, 0.7)", // Indigo
                        "rgba(138, 43, 226, 0.7)", // BlueViolet
                        "rgba(0, 128, 128, 0.7)", // Teal
                        "rgba(123, 104, 238, 0.7)", // MediumSlateBlue
                    ];

                    const colorArray = waveInfo.isBackward ? backwardWaveColors : forwardWaveColors;
                    const colorIndex = waveInfo.number % colorArray.length;
                    ctx.strokeStyle = colorArray[colorIndex];
                    ctx.lineWidth = 2;
                } else if (isCurrentEdge) {
                    ctx.strokeStyle = isBacktracking ? "rgba(255, 165, 0, 0.9)" : "#e0e322";
                    ctx.lineWidth = 3;
                } else if (isFinalPathEdge) {
                    ctx.strokeStyle = `rgba(0, 128, 0, 0.8)`;
                    ctx.lineWidth = 3;
                } else if (isVisitedEdge) {
                    ctx.strokeStyle = `rgba(255, 0, 0, 0.7)`;
                    ctx.lineWidth = 2;
                } else if (selectedCity === source.id || selectedCity === target.id) {
                    ctx.strokeStyle = `rgba(0, 128, 0, ${opacity + 0.2})`;
                    ctx.lineWidth = 2;
                } else {
                    ctx.strokeStyle = `rgba(10, 10, 10, ${opacity})`;
                    ctx.lineWidth = 1;
                }

                ctx.stroke();

                if (link.directed) {
                    const angle = Math.atan2(target.y - source.y, target.x - source.x);
                    const arrowLength = 10;

                    const arrowX = target.x - Math.cos(angle) * (target.radius + 2);
                    const arrowY = target.y - Math.sin(angle) * (target.radius + 2);

                    ctx.beginPath();
                    ctx.moveTo(arrowX, arrowY);
                    ctx.lineTo(
                        arrowX - arrowLength * Math.cos(angle - Math.PI / 6),
                        arrowY - arrowLength * Math.sin(angle - Math.PI / 6)
                    );
                    ctx.lineTo(
                        arrowX - arrowLength * Math.cos(angle + Math.PI / 6),
                        arrowY - arrowLength * Math.sin(angle + Math.PI / 6)
                    );
                    ctx.closePath();
                    ctx.fillStyle = ctx.strokeStyle;
                    ctx.fill();
                }

                const midX = (source.x + target.x) / 2;
                const midY = (source.y + target.y) / 2;
                ctx.fillStyle = "#555";
                ctx.font = "10px Arial";
                ctx.fillText(link.distance.toString(), midX, midY);
            }
        });

        // Draw nodes
        nodes.forEach((node) => {
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);

            const isCurrentNodeInAnimation = node.id === currentNode;

            const isInCurrentPath = currentPathAnimation.includes(node.id);

            const isVisitedNode = visitedNodes.has(node.id);

            if (isCurrentNodeInAnimation) {
                ctx.fillStyle = isBacktracking ? "#FFA500" : "#e0e322"; // Orange for backtracking, purple for current
            } else if (pathNodes.has(node.id)) {
                ctx.fillStyle = "#008000"; // Changed to green for final path nodes
            } else if (isInCurrentPath) {
                ctx.fillStyle = "#3CB371"; // Changed to medium sea green for current path
            } else if (isVisitedNode) {
                ctx.fillStyle = "#FF4500"; // Changed to red for visited but rejected nodes
            } else if (selectedCity === node.id) {
                ctx.fillStyle = "#00a300"; // Changed to green for selected node
            } else if (connectedCities.has(node.id)) {
                ctx.fillStyle = "#7ac97a"; // Lighter green for connected nodes
            } else if (hoveredCity === node.id) {
                ctx.fillStyle = "#f39c12"; // Kept orange for hovered node
            } else {
                ctx.fillStyle = node.color; // Default color
            }

            ctx.fill();

            // City label
            ctx.fillStyle = "#000";
            ctx.font = "bold 12px Arial";
            ctx.textAlign = "center";
            ctx.fillText(node.name, node.x, node.y - node.radius - 5);
        });

        ctx.restore();
    }, [
        nodes,
        links,
        selectedCity,
        hoveredCity,
        mapImage,
        connectedCities,
        pathNodes,
        pathEdges,
        currentNode,
        currentEdge,
        visitedNodes,
        visitedEdges,
        currentPathAnimation,
        isBacktracking,
        edgeToWaveMap,
    ]);

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const clickedNode = nodes.find((node) => {
            const dx = node.x - x;
            const dy = node.y - y;
            return Math.sqrt(dx * dx + dy * dy) <= node.radius;
        });

        if (isConnectingNodes && sourceNodeId && clickedNode && sourceNodeId !== clickedNode.id) {
            setIsConnectingNodes(false);
            openEdgeDialog(sourceNodeId, clickedNode.id);
            setSourceNodeId(null);
        } else if (clickedNode) {
            if (e.button === 0) {
                setSelectedCity(clickedNode.id === selectedCity ? null : clickedNode.id);
            } else if (e.button === 2) {
                setIsConnectingNodes(true);
                setSourceNodeId(clickedNode.id);
            }
        } else if (e.button === 0) {
            setSelectedCity(null);
            setNewNodePosition({ x, y });
            setIsCreatingNode(true);
        }
    };

    const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
        e.preventDefault();

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const clickedNode = nodes.find((node) => {
            const dx = node.x - x;
            const dy = node.y - y;
            return Math.sqrt(dx * dx + dy * dy) <= node.radius;
        });

        if (clickedNode) {
            if (e.shiftKey) {
                if (confirm(`Delete city "${clickedNode.id}" and all its connections?`)) {
                    deleteNode(clickedNode.id);
                }
            } else {
                setIsConnectingNodes(true);
                setSourceNodeId(clickedNode.id);
            }
        } else if (hoveredEdge && e.shiftKey) {
            const source = hoveredEdge.source;
            const target = hoveredEdge.target;
            if (confirm(`Delete connection between "${source}" and "${target}"?`)) {
                deleteEdge(source, target);
            }
        }
    };

    const deleteNode = (nodeId: string) => {
        setCities(cities.filter((city) => city !== nodeId));

        setNodes(nodes.filter((node) => node.id !== nodeId));

        setLinks(links.filter((link) => link.source !== nodeId && link.target !== nodeId));
        setConnections(connections.filter((conn) => conn.city1 !== nodeId && conn.city2 !== nodeId));

        if (selectedCity === nodeId) {
            setSelectedCity(null);
        }

        if (startCity === nodeId || endCity === nodeId) {
            setDfsPath(null);
            setPathNodes(new Set());
            setPathEdges(new Set());
            setAnimationSteps([]);
            setCurrentStepIndex(-1);
            resetAnimationState();

            if (startCity === nodeId) {
                setStartCity(cities.filter((city) => city !== nodeId)[0] || "");
            }
            if (endCity === nodeId) {
                setEndCity(cities.filter((city) => city !== nodeId)[0] || "");
            }
        }
    };

    const deleteEdge = (source: string, target: string) => {
        setLinks(
            links.filter(
                (link) =>
                    !(link.source === source && link.target === target) &&
                    !(link.source === target && link.target === source)
            )
        );

        setConnections(
            connections.filter(
                (conn) =>
                    !(conn.city1 === source && conn.city2 === target) &&
                    !(conn.city1 === target && conn.city2 === source)
            )
        );

        if (pathEdges.has(`${source}-${target}`) || pathEdges.has(`${target}-${source}`)) {
            setDfsPath(null);
            setPathNodes(new Set());
            setPathEdges(new Set());
            setAnimationSteps([]);
            setCurrentStepIndex(-1);
            resetAnimationState();
        }
    };

    const addNewNode = (name: string) => {
        if (!newNodePosition) return;

        const newCities = [...cities, name];
        setCities(newCities);

        const newNodes = [
            ...nodes,
            {
                id: name,
                x: newNodePosition.x,
                y: newNodePosition.y,
                radius: 6,
                color: "#3498db",
                name,
            },
        ];
        setNodes(newNodes);

        CITY_COORDINATES[name] = [newNodePosition.x, newNodePosition.y];

        setIsCreatingNode(false);
        setNewNodePosition(null);
    };

    const addNewEdge = (source: string, target: string, distance: number, directed: boolean) => {
        const edgeExists = links.some(
            (link) =>
                (link.source === source && link.target === target) ||
                (!directed && link.source === target && link.target === source)
        );

        if (edgeExists) {
            const updatedLinks = links.map((link) => {
                if (
                    (link.source === source && link.target === target) ||
                    (!directed && link.source === target && link.target === source)
                ) {
                    return { ...link, distance, directed };
                }
                return link;
            });
            setLinks(updatedLinks);

            const updatedConnections = connections.map((conn) => {
                if (
                    (conn.city1 === source && conn.city2 === target) ||
                    (!directed && conn.city1 === target && conn.city2 === source)
                ) {
                    return { ...conn, distance, directed };
                }
                return conn;
            });
            setConnections(updatedConnections);
        } else {
            const newLinks = [...links, { source, target, distance, directed }];
            setLinks(newLinks);

            const newConnections = [...connections, { city1: source, city2: target, distance, directed }];
            setConnections(newConnections);
        }
    };

    const openEdgeDialog = (source: string, target: string) => {
        setEdgeSource(source);
        setEdgeTarget(target);
        setIsCreatingEdge(true);
    };

    const confirmAddEdge = (distance: number, directed: boolean) => {
        if (isNaN(distance) || distance <= 0) {
            alert("Please enter a valid positive number for distance");
            return;
        }

        addNewEdge(edgeSource, edgeTarget, distance, directed);
        setIsCreatingEdge(false);
    };

    const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const hoveredNode = nodes.find((node) => {
            const dx = node.x - x;
            const dy = node.y - y;
            return Math.sqrt(dx * dx + dy * dy) <= node.radius;
        });

        setHoveredCity(hoveredNode ? hoveredNode.id : null);

        if (!hoveredNode) {
            const threshold = 5;
            let closestEdge = null;
            let minDistance = Infinity;

            links.forEach((link) => {
                const source = nodes.find((n) => n.id === link.source);
                const target = nodes.find((n) => n.id === link.target);

                if (source && target) {
                    const distance = pointToLineDistance(x, y, source.x, source.y, target.x, target.y);

                    if (distance < threshold && distance < minDistance) {
                        const minX = Math.min(source.x, target.x) - threshold;
                        const maxX = Math.max(source.x, target.x) + threshold;
                        const minY = Math.min(source.y, target.y) - threshold;
                        const maxY = Math.max(source.y, target.y) + threshold;

                        if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
                            minDistance = distance;
                            closestEdge = { source: link.source, target: link.target };
                        }
                    }
                }
            });

            setHoveredEdge(closestEdge);
        } else {
            setHoveredEdge(null);
        }
    };

    const pointToLineDistance = (x: number, y: number, x1: number, y1: number, x2: number, y2: number) => {
        const A = x - x1;
        const B = y - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;

        if (lenSq !== 0) {
            param = dot / lenSq;
        }

        let xx, yy;

        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        const dx = x - xx;
        const dy = y - yy;

        return Math.sqrt(dx * dx + dy * dy);
    };

    const getCityConnections = (cityId: string) => {
        const addedCities = new Set<string>();

        return links
            .filter((link) => link.source === cityId || link.target === cityId)
            .map((link) => {
                const connectedCity = link.source === cityId ? link.target : link.source;
                return {
                    city: connectedCity,
                    distance: link.distance,
                };
            })
            .filter((conn) => {
                if (addedCities.has(conn.city)) return false;
                addedCities.add(conn.city);
                return true;
            })
            .sort((a, b) => a.distance - b.distance);
    };

    return (
        <div className="flex gap-5 p-8">
            <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-center gap-5">
                    <div>
                        <label htmlFor="startCity">Start City: </label>
                        <select
                            id="startCity"
                            value={startCity}
                            onChange={(e) => setStartCity(e.target.value)}
                            style={{ padding: "5px", marginRight: "10px" }}
                        >
                            {cities.map((city) => (
                                <option key={`start-${city}`} value={city}>
                                    {city}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="endCity">End City: </label>
                        <select
                            id="endCity"
                            value={endCity}
                            onChange={(e) => setEndCity(e.target.value)}
                            style={{ padding: "5px", marginRight: "10px" }}
                        >
                            {cities.map((city) => (
                                <option key={`end-${city}`} value={city}>
                                    {city}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="algorithm">Algorithm: </label>
                        <select
                            id="algorithm"
                            value={algorithm}
                            onChange={(e) =>
                                setAlgorithm(
                                    e.target.value as "DFS" | "BFS" | "Dijkstra" | "Wave" | "BidirectionalWave"
                                )
                            }
                            style={{ padding: "5px", marginRight: "10px" }}
                        >
                            <option value="DFS">DFS</option>
                            <option value="BFS">BFS</option>
                            <option value="Wave">Wave</option>
                            <option value="BidirectionalWave">Bidirectional Wave</option>
                            <option value="Dijkstra">Dijkstra</option>
                        </select>
                    </div>

                    <div className="mr-2.5 flex items-center gap-1">
                        <Input
                            type="checkbox"
                            id="reverseTraversal"
                            checked={reverseTraversal}
                            onChange={(e) => setReverseTraversal(e.target.checked)}
                        />
                        <Label htmlFor="reverseTraversal">Reverse</Label>
                    </div>

                    <Button onClick={findPath}>Find Path</Button>
                </div>

                <div className="flex items-center gap-2.5">
                    <Button onClick={startAnimation} disabled={animationSteps.length === 0 || isAnimating}>
                        Play Animation
                    </Button>
                    <Button onClick={stopAnimation} disabled={!isAnimating} variant="secondary">
                        Stop Animation
                    </Button>
                    <Button onClick={resetAnimationState} disabled={animationSteps.length === 0} variant="destructive">
                        Reset
                    </Button>
                    <div className="flex gap-1">
                        <Label htmlFor="animationSpeed">Speed: </Label>
                        <select
                            id="animationSpeed"
                            value={animationSpeed}
                            onChange={(e) => setAnimationSpeed(Number(e.target.value))}
                            style={{ padding: "5px" }}
                        >
                            <option value="1000">Slow</option>
                            <option value="500">Medium</option>
                            <option value="200">Fast</option>
                        </select>
                    </div>
                    {isAnimating && (
                        <div className="ml-2.5">
                            Step {currentStepIndex} of {animationSteps.length}
                        </div>
                    )}
                </div>

                {dfsPath && (
                    <div className="flex max-w-3xl flex-col gap-2 rounded-md bg-gray-100 p-3.5 shadow-md">
                        <h3 className="text-lg font-medium">{algorithm}</h3>
                        <p>
                            <strong>Path:</strong> {dfsPath.path.join(" → ")}
                        </p>
                        <p>
                            <strong>Total Distance:</strong> {dfsPath.totalDistance} km
                        </p>
                        <p>
                            <strong>Time taken:</strong> {time} ms
                        </p>
                    </div>
                )}

                <div className="flex gap-5">
                    <div className="overflow-hidden rounded-md border shadow-md">
                        <canvas
                            ref={canvasRef}
                            width={800}
                            height={500}
                            onClick={handleCanvasClick}
                            onMouseMove={handleCanvasMouseMove}
                            onContextMenu={handleContextMenu}
                            style={{ cursor: hoveredCity ? "pointer" : isConnectingNodes ? "crosshair" : "default" }}
                        />
                    </div>

                    {selectedCity && (
                        <div className="city-info">
                            <h3>{selectedCity}</h3>
                            <p>{getCityConnections(selectedCity).length} connections</p>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Connected City</th>
                                        <th>Distance (km)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {getCityConnections(selectedCity).map((conn) => (
                                        <tr key={conn.city}>
                                            <td>{conn.city}</td>
                                            <td>{conn.distance}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <CreateNodeDialog isOpen={isCreatingNode} onCreate={addNewNode} onClose={() => setIsCreatingNode(false)} />
            {isConnectingNodes && !!sourceNodeId && (
                <AddingEdgePopup
                    sourceNodeId={sourceNodeId}
                    onCancel={() => {
                        setIsConnectingNodes(false);
                        setSourceNodeId(null);
                    }}
                />
            )}
            <AddEdgeDialog
                isOpen={isCreatingEdge}
                edgeSource={edgeSource}
                edgeTarget={edgeTarget}
                onAdd={confirmAddEdge}
                onClose={() => setIsCreatingEdge(false)}
            />
        </div>
    );
};

export default App;
