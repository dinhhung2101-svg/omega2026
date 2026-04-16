"""
Event Store - Shared SSE broadcast state (singleton).
Import từ booking.py và routers/events.py.
"""
import asyncio
import json
from typing import List, Dict, Any


class EventStore:
    """Lưu trữ danh sách client đang kết nối SSE."""

    def __init__(self):
        self.clients: List[asyncio.Queue] = []

    async def connect(self) -> asyncio.Queue:
        queue = asyncio.Queue()
        self.clients.append(queue)
        return queue

    async def disconnect(self, queue: asyncio.Queue):
        self.clients = [q for q in self.clients if q is not queue]

    async def broadcast(self, message: Dict[str, Any]):
        for queue in self.clients:
            await queue.put(json.dumps(message, default=str))


event_store = EventStore()
