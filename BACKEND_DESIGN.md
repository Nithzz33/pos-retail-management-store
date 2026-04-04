# 🚀 Production-Ready Backend System Design (Uber/Swiggy/Zomato Level)

This document outlines the architecture and implementation details for a high-performance, scalable delivery backend optimized for Indian urban environments.

---

## 🧩 1. System Architecture (ASCII)

```text
                                 +-------------------+
                                 |   Client (App)    |
                                 +---------+---------+
                                           |
                                   [ HTTPS / WSS ]
                                           |
                                 +---------v---------+
                                 |   API Gateway     | (Nginx / Kong)
                                 +---------+---------+
                                           |
         +---------------------------------+---------------------------------+
         |                                 |                                 |
+--------v--------+               +--------v--------+               +--------v--------+
|  Order Service  |               |  Rider Service  |               | Matching Service|
| (PostgreSQL)    |               | (Redis GEO)     |               | (Scoring Engine)|
+--------+--------+               +--------+--------+               +--------+--------+
         |                                 |                                 |
         +----------------+----------------+----------------+----------------+
                          |                |                |
                  +-------v----------------v----------------v-------+
                  |          Message Queue (Kafka / RabbitMQ)       |
                  +------------------------+------------------------+
                                           |
                                  +--------v--------+
                                  | Dispatch Service| (WebSocket / Socket.io)
                                  +--------+--------+
                                           |
                                  +--------v--------+
                                  |   Rider App     |
                                  +-----------------+
```

---

## ⚙️ 2. Service Responsibilities

### 1. API Gateway
- **Auth & Rate Limiting:** JWT validation and preventing DDoS.
- **Routing:** Directing requests to appropriate microservices.

### 2. Order Service
- **Lifecycle Management:** Creation, payment, and status updates.
- **Persistence:** PostgreSQL with PostGIS for delivery coordinates.

### 3. Rider Service
- **Spatial Indexing:** Uses **Redis GEO** for real-time rider tracking.
- **Availability:** Manages online/offline/busy states.

### 4. Matching Service (The Brain)
- **Spatial Filter:** Fetches nearby riders using Geohash/Redis GEO.
- **Traffic Engine:** Integrates with Google Maps Distance Matrix API.
- **Scoring Engine:** Ranks riders based on ETA, Rating, and Acceptance Rate.

### 5. Dispatch Service (WebSocket)
- **Real-Time Communication:** Uses Socket.io for instant order delivery to riders.
- **Batch Dispatch:** Handles the "First-Accept-Wins" logic and timeouts.

---

## 🔄 3. Data Flow (Step-by-Step)

1.  **Order Created:** Customer places an order. Order Service persists it and emits an `ORDER_CREATED` event to Kafka.
2.  **Spatial Lookup:** Matching Service consumes the event, queries Redis for riders within a 5km radius.
3.  **Initial Filter:** Top 20 riders are filtered using **Haversine** distance.
4.  **Traffic-Aware ETA:** Google Maps API is called for the top 20 riders to get real-world `duration_in_traffic`.
5.  **Scoring:**
    `Score = (w1 * (1 / ETA)) + (w2 * Rating) + (w3 * AcceptanceRate)`
6.  **Batch Dispatch:** Top 5 riders receive a `NEW_ORDER` event via WebSocket.
7.  **Acceptance:** First rider to respond with `ACCEPT_ORDER` gets the job. Redis `SETNX` is used for atomic locking.
8.  **Retry Logic:** If no one accepts in 10 seconds, the next batch of 5 riders is notified.

---

## 📦 4. Data Structures

### Rider Schema (PostgreSQL/PostGIS)
```sql
CREATE TABLE riders (
    id UUID PRIMARY KEY,
    name VARCHAR(100),
    rating DECIMAL(3,2),
    acceptance_rate DECIMAL(5,2),
    status VARCHAR(20), -- 'online', 'busy', 'offline'
    current_location GEOGRAPHY(POINT, 4326),
    last_updated TIMESTAMP
);
```

### Redis GEO Structure
- **Key:** `riders:locations`
- **Member:** `rider_id`
- **Value:** `longitude latitude`

---

## ⚡ 5. Performance & Scaling

- **Redis Clustering:** Partitioning rider locations by city or geohash prefix.
- **Kafka Partitioning:** Using `order_id` as the partition key to ensure sequential processing.
- **Horizontal Scaling:** WebSocket servers are stateless, using a Redis Pub/Sub adapter to sync events.
- **Caching:** Frequent routes (e.g., popular restaurants to residential hubs) are cached in Redis to reduce API costs.

---

## 💸 6. Surge Pricing Formula

`SurgeMultiplier = (Demand / Supply) * TimeFactor * WeatherFactor`
- **Demand:** Number of pending orders in a geohash zone.
- **Supply:** Number of online riders in the same zone.
- **Anti-Manipulation:** Moving average smoothing to prevent sudden spikes from single large orders.
