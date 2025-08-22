import asyncpg
import asyncio

_pool: asyncpg.Pool | None = None
_lock = asyncio.Lock()


async def create_pool() -> asyncpg.Pool:
    """Возвращает пул соединений (синглтон). Пересоздаёт, если закрыт."""
    global _pool

    async with _lock:  # защищаем от одновременного вызова
        if _pool is None or _pool._closed:
            _pool = await asyncpg.create_pool(
                user="demper_user",
                password="tUrGenTLaMySHWARestOrecKERguEb",
                database="demper",
                host="95.179.187.42",
                port=6432,
                min_size=10,
                max_size=50,
                max_queries=50000,
                timeout=30,
            )
    return _pool


async def close_pool():
    """Закрыть пул соединений (на shutdown)."""
    global _pool
    if _pool and not _pool._closed:
        await _pool.close()
        _pool = None