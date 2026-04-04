# 🚀 Scalable Rider Assignment System Design

This document outlines the architecture and implementation of a high-performance, real-time rider assignment system for a delivery platform (Uber Eats / Swiggy style).

---

## 🏗️ System Architecture

The system is designed for horizontal scalability, low latency (<200ms), and high availability.

```text
[ Rider App ] <--- WebSocket / Push (gRPC/MQTT) ---> [ Dispatcher Service ]
      |                                                     |
      v                                                     v
[ Location Svc ] ----> [ Redis (Geo Index) ] <---- [ Matching Service ]
      |                                                     ^
      v                                                     |
[ Kafka / MQ ] <-------------------------------------- [ Order Service ]
      |                                                     |
      v                                                     v
[ PostGIS / DB ] <----------------------------------- [ API Gateway ] <--- [ User App ]
```

### Key Components:
1.  **API Gateway**: Handles authentication, rate limiting, and request routing.
2.  **Order Service**: Manages order lifecycle (placed, assigned, picked up, delivered).
3.  **Matching Service**: The "brain" that finds the best riders for an order.
4.  **Location Service**: Ingests real-time GPS updates from thousands of riders (using gRPC or MQTT for efficiency).
5.  **Redis (Geo Index)**: Stores the latest rider locations using Geohashes for O(1) proximity lookups.
6.  **Kafka / Message Queue**: Decouples services and ensures reliable event processing (e.g., "Order Placed" -> "Matching Service").
7.  **PostGIS / Database**: Persistent storage for historical data, rider profiles, and complex spatial queries.

---

## 🧩 Algorithm Design

### 1. Spatial Indexing (Geohash)
Instead of running Dijkstra on all riders, we use **Geohashes** to partition the map into a grid.
-   **Precision**: We use 6-character Geohashes (~1.2km x 0.6km cells).
-   **Lookup**: Proximity search is a simple range query on the Geohash string (e.g., `WHERE geohash >= 'tdr1' AND geohash <= 'tdr9'`).

### 2. Haversine Filtering
For the initial set of nearby riders, we use the **Haversine distance** (straight-line distance on a sphere) to filter out riders who are too far away. This is computationally cheap and perfect for the first pass.

### 3. A* Pathfinding (ETA Calculation)
For the top K riders, we calculate the actual **ETA** using a simplified **A*** algorithm or a pre-computed **Contraction Hierarchy (CH)**.
-   **Road Network**: Unlike Haversine, A* considers the actual road network, one-way streets, and turn restrictions.
-   **Dynamic Factors**: We adjust the edge weights in the graph based on real-time traffic data.

### 4. Rider Scoring System
Riders are ranked using a multi-factor score:
`Score = (w1 * ETA) + (w2 * Rating) + (w3 * AcceptanceRate)`
-   **w1 (ETA)**: Prioritizes fast delivery (highest weight).
-   **w2 (Rating)**: Ensures high service quality.
-   **w3 (Acceptance Rate)**: Rewards reliable riders and improves overall system efficiency.

---

## 🔄 Matching Flow

1.  **Order Placed**: User places an order; `Order Service` emits an `ORDER_CREATED` event to Kafka.
2.  **Fetch Nearby**: `Matching Service` consumes the event and queries Redis for riders in the order's Geohash and 8 neighboring cells.
3.  **Filter Top K**: Calculate Haversine distance for all found riders; keep the top 20-50.
4.  **Compute ETA**: Run A* (or query a Routing Engine like OSRM/GraphHopper) for the top K riders.
5.  **Rank**: Apply the scoring formula to rank the riders.
6.  **Batch Dispatch**: Send requests to the top N riders (e.g., top 3) via WebSockets.
7.  **First Acceptance**: The first rider to accept "wins" the order. Distributed locks in Redis prevent double-assignment.
8.  **Timeout/Retry**: If no one accepts within 30s, the system expands the search radius and repeats the process.

---

## 🛠️ Optimization Techniques

-   **Contraction Hierarchies (CH)**: Pre-calculates "shortcuts" in the road network graph to speed up shortest-path queries by 1000x compared to standard Dijkstra.
-   **Route Caching**: Cache ETAs for frequent (Source, Destination) pairs (e.g., popular restaurants to residential hubs).
-   **Load Balancing**: Use consistent hashing to distribute riders across multiple `Location Service` nodes based on their Geohash.
-   **Horizontal Scaling**: All services are stateless and can be scaled independently using Kubernetes.

---

## ⚠️ Edge Cases & Error Handling

-   **No Riders Nearby**: Implement **Dynamic Radius Expansion** (e.g., 2km -> 5km -> 10km). If still none, notify the user or offer a scheduled delivery.
-   **Rider Rejects**: Immediately trigger a re-matching process for the next best rider in the queue.
-   **Simultaneous Acceptance**: Use **Redis SETNX** or **Firestore Transactions** to ensure only one rider is assigned.
-   **Network Delays**: Implement "Heartbeat" checks for riders. If a rider's location hasn't updated in 5 minutes, mark them as `offline`.

---

## 💻 Code Implementation

See the following files in the codebase for the working implementation:
-   `src/utils/geoUtils.ts`: Distance, ETA, and Scoring logic.
-   `src/services/riderAssignmentService.ts`: Core matching and dispatch service.
