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

    // DFS state
    const [startCity, setStartCity] = useState<string>("");
    const [endCity, setEndCity] = useState<string>("");
    const [dfsPath, setDfsPath] = useState<PathResult | null>(null);
    const [pathNodes, setPathNodes] = useState<Set<string>>(new Set());
    const [pathEdges, setPathEdges] = useState<Set<string>>(new Set());
    const [reverseTraversal, setReverseTraversal] = useState<boolean>(false);

    // Animation state
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

    // Create graph nodes and links
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

    // Build adjacency list for DFS
    const buildAdjacencyList = () => {
        const adjacencyList: Record<string, { city: string; distance: number }[]> = {};

        cities.forEach((city) => {
            adjacencyList[city] = [];
        });

        links.forEach((link) => {
            adjacencyList[link.source].push({ city: link.target, distance: link.distance });

            // Only add the reverse direction if the edge is not directed
            if (!link.directed) {
                adjacencyList[link.target].push({ city: link.source, distance: link.distance });
            }
        });

        return adjacencyList;
    };

    // Perform DFS with animation steps
    const performDFS = () => {
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

        // Initialize distances
        cities.forEach((city) => {
            distanceMap[city] = 0;
        });

        const dfs = (current: string, target: string, currentPath: string[], currentDistance: number): boolean => {
            if (current === target) {
                pathStack.push(...currentPath, current);
                return true;
            }

            visited.add(current);
            // Record visit to this node as an animation step (no edge yet)
            animSteps.push({
                currentNode: current,
                visitedEdge: null,
                currentPath: [...currentPath],
                isBacktrack: false,
            });

            currentPath.push(current);

            // Get neighbors and sort them based on traversal direction
            const neighbors = [...adjacencyList[current]];
            if (reverseTraversal) {
                neighbors.reverse();
            }

            for (const neighbor of neighbors) {
                if (!visited.has(neighbor.city)) {
                    // Record trying this edge as an animation step
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

            // Record backtracking from this node
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
            // Create path nodes and edges sets for final highlighting
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

            // Set animation steps for playback
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
    };

    const resetAnimationState = () => {
        setCurrentNode(null);
        setCurrentEdge(null);
        setVisitedNodes(new Set());
        setVisitedEdges(new Set());
        setCurrentPathAnimation([]);
        setIsBacktracking(false);
        stopAnimation();
    };

    const startAnimation = () => {
        if (animationSteps.length === 0) {
            return;
        }

        setIsAnimating(true);
        setCurrentStepIndex(0);
        setPathNodes(new Set());
        setPathEdges(new Set());
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
            const timeoutId = setTimeout(() => {
                const step = animationSteps[currentStepIndex];

                // Update current node
                setCurrentNode(step.currentNode);

                // Add to visited nodes
                setVisitedNodes((prev) => {
                    const updated = new Set(prev);
                    updated.add(step.currentNode);
                    return updated;
                });

                // Update current edge if present
                if (step.visitedEdge) {
                    setCurrentEdge(step.visitedEdge);

                    // Add to visited edges
                    setVisitedEdges((prev) => {
                        const updated = new Set(prev);
                        updated.add(`${step.visitedEdge!.source}-${step.visitedEdge!.target}`);
                        updated.add(`${step.visitedEdge!.target}-${step.visitedEdge!.source}`);
                        return updated;
                    });
                } else {
                    setCurrentEdge(null);
                }

                // Update current path for animation
                setCurrentPathAnimation(step.currentPath);

                // Set backtracking status
                setIsBacktracking(step.isBacktrack);

                // Move to next step
                setCurrentStepIndex((prev) => prev + 1);
            }, animationSpeed);

            return () => clearTimeout(timeoutId);
        } else if (isAnimating && currentStepIndex >= animationSteps.length) {
            // End of animation
            setIsAnimating(false);
        }
    }, [isAnimating, currentStepIndex, animationSteps, animationSpeed]);

    // Draw the graph on the canvas
    useEffect(() => {
        if (!canvasRef.current || nodes.length === 0 || links.length === 0) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Set canvas size
        canvas.width = 800;
        canvas.height = 500;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);

        // Draw map image if loaded
        if (mapImage) {
            // Draw the map to fit the canvas while maintaining aspect ratio
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

                // Find max distance for opacity calculation
                const maxDistance = Math.max(...links.map((l) => l.distance));

                // Calculate opacity based on distance (higher distance = lighter line)
                const opacity = 1 - (link.distance / maxDistance) * 0.8;

                // Animation: determine if this is the current edge being explored
                const isCurrentEdge =
                    currentEdge &&
                    ((currentEdge.source === link.source && currentEdge.target === link.target) ||
                        (currentEdge.target === link.source && currentEdge.source === link.target));

                // Animation: determine if this edge has been visited
                const edgeKey1 = `${link.source}-${link.target}`;
                const edgeKey2 = `${link.target}-${link.source}`;
                const isVisitedEdge = visitedEdges.has(edgeKey1) || visitedEdges.has(edgeKey2);

                // Check if this edge is part of the final DFS path
                const isFinalPathEdge =
                    pathEdges.has(`${link.source}-${link.target}`) || pathEdges.has(`${link.target}-${link.source}`);

                // Highlight based on priority
                if (isCurrentEdge) {
                    ctx.strokeStyle = isBacktracking ? "rgba(255, 165, 0, 0.9)" : "rgba(75, 0, 130, 0.9)"; // Orange for backtracking, purple for exploration
                    ctx.lineWidth = 3;
                } else if (isFinalPathEdge) {
                    ctx.strokeStyle = `rgba(0, 128, 0, 0.8)`; // Changed to green for selected/final path
                    ctx.lineWidth = 3;
                } else if (isVisitedEdge) {
                    ctx.strokeStyle = `rgba(255, 0, 0, 0.7)`; // Changed to red for visited but rejected edges
                    ctx.lineWidth = 2;
                } else if (selectedCity === source.id || selectedCity === target.id) {
                    ctx.strokeStyle = `rgba(0, 128, 0, ${opacity + 0.2})`; // Changed to green for selected connections
                    ctx.lineWidth = 2;
                } else {
                    ctx.strokeStyle = `rgba(10, 10, 10, ${opacity})`;
                    ctx.lineWidth = 1;
                }

                ctx.stroke();

                if (link.directed) {
                    // Calculate arrow points
                    const angle = Math.atan2(target.y - source.y, target.x - source.x);
                    const arrowLength = 10;

                    // Position the arrow near the target but not on it
                    const arrowX = target.x - Math.cos(angle) * (target.radius + 2);
                    const arrowY = target.y - Math.sin(angle) * (target.radius + 2);

                    // Draw the arrowhead
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

                // Draw distance label
                const midX = (source.x + target.x) / 2;
                const midY = (source.y + target.y) / 2;
                ctx.fillStyle = "#555";
                ctx.font = "10px Arial";
                ctx.fillText(link.distance.toString(), midX, midY);
            }
        });

        // Draw nodes
        nodes.forEach((node) => {
            // Node circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);

            // Animation: determine if this is the current node being explored
            const isCurrentNodeInAnimation = node.id === currentNode;

            // Animation: determine if this node is part of the current path
            const isInCurrentPath = currentPathAnimation.includes(node.id);

            // Animation: determine if this node has been visited
            const isVisitedNode = visitedNodes.has(node.id);

            // Check if node is in final DFS path
            if (isCurrentNodeInAnimation) {
                ctx.fillStyle = isBacktracking ? "#FFA500" : "#800080"; // Orange for backtracking, purple for current
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
            // Second click after selecting source node - prepare to add edge
            setIsConnectingNodes(false);
            openEdgeDialog(sourceNodeId, clickedNode.id);
            setSourceNodeId(null);
        } else if (clickedNode) {
            if (e.button === 0) {
                // Left click
                setSelectedCity(clickedNode.id === selectedCity ? null : clickedNode.id);
            } else if (e.button === 2) {
                // Right click
                setIsConnectingNodes(true);
                setSourceNodeId(clickedNode.id);
            }
        } else if (e.button === 0) {
            // Left click on empty space
            setSelectedCity(null);
            setNewNodePosition({ x, y });
            setIsCreatingNode(true);
        }
    };

    const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
        e.preventDefault(); // Prevent default context menu

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
                // Shift+Right click to delete node
                if (confirm(`Delete city "${clickedNode.id}" and all its connections?`)) {
                    deleteNode(clickedNode.id);
                }
            } else {
                setIsConnectingNodes(true);
                setSourceNodeId(clickedNode.id);
            }
        } else if (hoveredEdge && e.shiftKey) {
            // Shift+Right click on edge to delete it
            const source = hoveredEdge.source;
            const target = hoveredEdge.target;
            if (confirm(`Delete connection between "${source}" and "${target}"?`)) {
                deleteEdge(source, target);
            }
        }
    };

    const deleteNode = (nodeId: string) => {
        // Remove node from cities array
        setCities(cities.filter((city) => city !== nodeId));

        // Remove node from nodes array
        setNodes(nodes.filter((node) => node.id !== nodeId));

        // Remove all connections involving this node
        setLinks(links.filter((link) => link.source !== nodeId && link.target !== nodeId));
        setConnections(connections.filter((conn) => conn.city1 !== nodeId && conn.city2 !== nodeId));

        // If the node being deleted is selected, clear selection
        if (selectedCity === nodeId) {
            setSelectedCity(null);
        }

        // If the node is part of DFS path settings, reset them
        if (startCity === nodeId || endCity === nodeId) {
            setDfsPath(null);
            setPathNodes(new Set());
            setPathEdges(new Set());
            setAnimationSteps([]);
            setCurrentStepIndex(-1);
            resetAnimationState();

            // Reset start/end cities if needed
            if (startCity === nodeId) {
                setStartCity(cities.filter((city) => city !== nodeId)[0] || "");
            }
            if (endCity === nodeId) {
                setEndCity(cities.filter((city) => city !== nodeId)[0] || "");
            }
        }
    };

    const deleteEdge = (source: string, target: string) => {
        // Remove the edge from links array
        setLinks(
            links.filter(
                (link) =>
                    !(link.source === source && link.target === target) &&
                    !(link.source === target && link.target === source)
            )
        );

        // Remove the connection from connections array
        setConnections(
            connections.filter(
                (conn) =>
                    !(conn.city1 === source && conn.city2 === target) &&
                    !(conn.city1 === target && conn.city2 === source)
            )
        );

        // Reset path if it contains this edge
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

        // Update cities state
        const newCities = [...cities, name];
        setCities(newCities);

        // Update nodes state
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

        // Update city coordinates
        CITY_COORDINATES[name] = [newNodePosition.x, newNodePosition.y];

        // Clear creation state
        setIsCreatingNode(false);
        setNewNodePosition(null);
    };

    const addNewEdge = (source: string, target: string, distance: number, directed: boolean) => {
        // Check if edge already exists
        const edgeExists = links.some(
            (link) =>
                (link.source === source && link.target === target) ||
                (!directed && link.source === target && link.target === source)
        );

        if (edgeExists) {
            // Update existing edge
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

            // Update connections
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
            // Add new edge
            const newLinks = [...links, { source, target, distance, directed }];
            setLinks(newLinks);

            // Add new connection
            const newConnections = [...connections, { city1: source, city2: target, distance, directed }];
            setConnections(newConnections);
        }
    };

    const openEdgeDialog = (source: string, target: string) => {
        setEdgeSource(source);
        setEdgeTarget(target);
        setIsCreatingEdge(true);
    };

    // Add new function for adding edge after dialog
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

        // Check if hovering over a node
        const hoveredNode = nodes.find((node) => {
            const dx = node.x - x;
            const dy = node.y - y;
            return Math.sqrt(dx * dx + dy * dy) <= node.radius;
        });

        setHoveredCity(hoveredNode ? hoveredNode.id : null);

        // If not hovering over a node, check if hovering over an edge
        if (!hoveredNode) {
            const threshold = 5; // Distance threshold for edge detection
            let closestEdge = null;
            let minDistance = Infinity;

            links.forEach((link) => {
                const source = nodes.find((n) => n.id === link.source);
                const target = nodes.find((n) => n.id === link.target);

                if (source && target) {
                    // Calculate distance from point to line
                    const distance = pointToLineDistance(x, y, source.x, source.y, target.x, target.y);

                    // Check if the point is within the line segment
                    if (distance < threshold && distance < minDistance) {
                        // Check if the point is within the bounding box of the line
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

                    <div className="mr-2.5 flex items-center gap-1">
                        <Input
                            type="checkbox"
                            id="reverseTraversal"
                            checked={reverseTraversal}
                            onChange={(e) => setReverseTraversal(e.target.checked)}
                        />
                        <Label htmlFor="reverseTraversal">Reverse</Label>
                    </div>

                    <Button onClick={performDFS}>Find Path</Button>
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
                        <h3 className="text-lg font-medium">DFS</h3>
                        <p>
                            <strong>Path:</strong> {dfsPath.path.join(" → ")}
                        </p>
                        <p>
                            <strong>Total Distance:</strong> {dfsPath.totalDistance} km
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
