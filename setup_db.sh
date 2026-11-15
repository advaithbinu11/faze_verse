#!/bin/bash

# Database setup script for FaZeLobby using MongoDB (mongosh)
DB_NAME="FaZeVault"

mongosh "$DB_NAME" <<EOF
// Create Users Collection with Schema Validation
db.createCollection("users", {
  validator: {
    \$jsonSchema: {
      bsonType: "object",
      required: ["name", "faze_points"],
      properties: {
        name: { bsonType: "string" },
        steam_id: { bsonType: "string" },
        faze_points: { bsonType: "int" },
        watched_history: {
          bsonType: "array",
          items: { bsonType: "string" }
        },
        teams_followed: {
          bsonType: "array",
          items: { bsonType: "string" }
        },
        discord_channel: { bsonType: "string" }
      }
    }
  }
});

// Create Events Collection with Total Points Invested Tracking
db.createCollection("events", {
  validator: {
    \$jsonSchema: {
      bsonType: "object",
      required: ["event_id", "title", "team_a", "team_b", "game_name", "start_time", "status", "total_points_invested"],
      properties: {
        event_id: { bsonType: "string" },
        title: { bsonType: "string" },
        team_a: { bsonType: "string" },
        team_b: { bsonType: "string" },
        game_name: { bsonType: "string" },
        start_time: { bsonType: "date" },
        status: { enum: ["upcoming", "live", "completed"] },
        total_points_invested: { bsonType: "int" },
        winner: { bsonType: ["string", "null"] }
      }
    }
  }
});

// Create Parties Collection
db.createCollection("parties", {
  validator: {
    \$jsonSchema: {
      bsonType: "object",
      required: ["party_id", "game_name", "num_people"],
      properties: {
        party_id: { bsonType: "string" },
        discord_channel_link: { bsonType: "string" },
        game_id: { bsonType: "string" },
        game_name: { bsonType: "string" },
        num_people: { bsonType: "int" },
        people: {
          bsonType: "array",
          items: { bsonType: "objectId" }
        }
      }
    }
  }
});

// Create Point Transactions Ledger Collection for Anti-Exploit Security
db.createCollection("point_transactions", {
  validator: {
    \$jsonSchema: {
      bsonType: "object",
      required: ["user_id", "points", "source_type", "timestamp"],
      properties: {
        user_id: { bsonType: "objectId" },
        event_id: { bsonType: "string" },
        points: { bsonType: "int" },
        source_type: { enum: ["prediction", "watch_time", "redemption"] },
        timestamp: { bsonType: "date" }
      }
    }
  }
});

// Build Performance Indexes
db.users.createIndex({ steam_id: 1 }, { sparse: true, unique: true });
db.events.createIndex({ status: 1, start_time: 1 });
db.parties.createIndex({ game_id: 1 });
db.point_transactions.createIndex({ user_id: 1, timestamp: -1 });
db.point_transactions.createIndex({ event_id: 1 });

print("FaZeLobby MongoDB collections and indexes updated with event point pools.");
EOF

