"""
Hotel Demand Cognition Model - SSE Server
==========================================
Python 3 标准库实现，零第三方依赖。
启动: python server.py
访问: http://localhost:8080

功能:
- /           → 静态文件服务 (index.html)
- /events     → SSE 端点，推送需求认知事件流
- /trigger    → 手动触发随机事件注入

协议:
  event: new_event       → 新 Big Event 检测
  event: social_spike    → 社交信号异常飙升
  event: demand_update   → 需求数据定期更新
  event: status_change   → 城区需求状态跃迁
  event: heartbeat       → 保活心跳 (15s)
"""

import http.server
import json
import os
import random
import sys
import threading
import time
import mimetypes
from socketserver import ThreadingMixIn

# Windows 控制台 UTF-8 编码兼容
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# ============================================================
# 可配置参数
# ============================================================
PORT = int(os.environ.get("PORT", 8080))
INTERVAL = int(os.environ.get("INTERVAL", 8))  # 事件推送间隔(秒)

# ============================================================
# 模拟城区
# ============================================================
DISTRICTS = [
    {"id": "qixia",   "name": "栖霞区", "lat": 32.12, "lng": 118.91, "hotels": 42},
    {"id": "xuanwu",  "name": "玄武区", "lat": 32.06, "lng": 118.80, "hotels": 68},
    {"id": "gulou",   "name": "鼓楼区", "lat": 32.07, "lng": 118.77, "hotels": 89},
    {"id": "jianye",  "name": "建邺区", "lat": 32.01, "lng": 118.72, "hotels": 55},
    {"id": "qinhuai", "name": "秦淮区", "lat": 32.02, "lng": 118.79, "hotels": 73},
    {"id": "yuhuatai","name": "雨花台区","lat": 31.99, "lng": 118.77, "hotels": 38},
]

EVENT_TYPES = ["concert", "sports", "exhibition", "festival"]
EVENT_TYPE_NAMES = {
    "concert":    "演唱会",
    "sports":     "体育赛事",
    "exhibition": "展览会议",
    "festival":   "节庆活动",
}
EVENT_TYPE_ICONS = {
    "concert": "\U0001F3B5",    # 🎵
    "sports": "⚽",         # ⚽
    "exhibition": "\U0001F3AA", # 🎪
    "festival": "\U0001F386",   # 🎆
}

DEMAND_STATES = ["LOW", "NORMAL", "RISING", "PEAK", "DECLINING"]

# ============================================================
# 预设事件时间线
# ============================================================
def make_timeline():
    """构建预设事件队列。每个元素: {delay_seconds, event_type, data}"""
    now = time.time()
    return [
        # t=2s: 初始心跳
        {"delay": 2, "event": "heartbeat",
         "data": {"timestamp": _ts(now + 2)}},

        # t=5s: 鼓楼区社交信号飙升 (CBA联赛预热)
        {"delay": 5, "event": "social_spike",
         "data": {"district": "gulou", "metric": "search_index", "value": 78,
                  "changePercent": 45, "timestamp": _ts(now + 5)}},

        # t=8s: 定期需求更新
        {"delay": 8, "event": "demand_update",
         "data": {"district": "jianye", "demandMultiplier": 3.2, "state": "PEAK",
                  "hotels": 55, "timestamp": _ts(now + 8)}},

        # t=12s: 鼓楼区需求更新 (CBA联赛需求上升)
        {"delay": 12, "event": "demand_update",
         "data": {"district": "gulou", "demandMultiplier": 2.4, "state": "RISING",
                  "hotels": 89, "timestamp": _ts(now + 12)}},

        # t=18s: 建邺区状态跃迁
        {"delay": 18, "event": "status_change",
         "data": {"district": "jianye", "fromState": "RISING",
                  "toState": "PEAK", "confidence": 0.96, "timestamp": _ts(now + 18)}},

        # t=25s: 鼓楼区状态跃迁
        {"delay": 25, "event": "status_change",
         "data": {"district": "gulou", "fromState": "RISING",
                  "toState": "PEAK", "confidence": 0.92, "timestamp": _ts(now + 25)}},

        # t=32s: 秦淮区社交信号飙升 (灯会)
        {"delay": 32, "event": "social_spike",
         "data": {"district": "qinhuai", "metric": "topic_heat", "value": 65,
                  "changePercent": 38, "timestamp": _ts(now + 32)}},

        # t=40s: 🆕 检测到新事件! 展览
        {"delay": 40, "event": "new_event",
         "data": {"id": "evt_003", "name": "南京国际博览中心 — 科技创新展",
                  "type": "exhibition", "district": "jianye", "venue": "南京国际博览中心",
                  "lat": 32.00, "lng": 118.71, "capacity": 30000,
                  "demandMultiplier": 1.8, "confidence": 0.92,
                  "timestamp": _ts(now + 40)}},

        # t=48s: 展览带来的需求更新
        {"delay": 48, "event": "demand_update",
         "data": {"district": "jianye", "demandMultiplier": 3.6, "state": "PEAK",
                  "hotels": 55, "timestamp": _ts(now + 48)}},

        # t=55s: 新事件需求上升
        {"delay": 55, "event": "demand_update",
         "data": {"district": "qinhuai", "demandMultiplier": 2.1, "state": "RISING",
                  "hotels": 73, "timestamp": _ts(now + 55)}},

        # t=62s: 栖霞区社交信号 (新体育赛事前兆)
        {"delay": 62, "event": "social_spike",
         "data": {"district": "qixia", "metric": "review_sentiment", "value": 72,
                  "changePercent": 52, "timestamp": _ts(now + 62)}},

        # t=70s: 🆕 第二个新事件
        {"delay": 70, "event": "new_event",
         "data": {"id": "evt_004", "name": "栖霞山秋季登高节",
                  "type": "festival", "district": "qixia", "venue": "栖霞山风景区",
                  "lat": 32.15, "lng": 118.95, "capacity": 50000,
                  "demandMultiplier": 2.3, "confidence": 0.88,
                  "timestamp": _ts(now + 70)}},
    ]


def _ts(t):
    """格式化 ISO 时间戳"""
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(t))


# ============================================================
# 手动触发: 随机生成事件
# ============================================================
def random_event():
    """生成一个随机的 SSE 事件，用于 /trigger"""
    event_type = random.choice(["new_event", "social_spike", "status_change", "demand_update"])
    district = random.choice(DISTRICTS)
    ts = _ts(time.time())

    if event_type == "new_event":
        etype = random.choice(EVENT_TYPES)
        names = {
            "concert":    ["周杰伦巡回演唱会", "五月天演唱会", "林俊杰演唱会", "薛之谦演唱会"],
            "sports":     ["中超联赛", "CBA常规赛", "国际马拉松", "网球公开赛"],
            "exhibition": ["智能制造业博览会", "国际汽车展", "动漫游戏展", "国际医疗展"],
            "festival":   ["秦淮灯会", "梅花节", "美食文化节", "国际音乐节"],
        }
        venues = {
            "concert":    ["奥体中心体育馆", "五台山体育馆"],
            "sports":     ["奥体中心体育场", "龙江体育馆"],
            "exhibition": ["国际博览中心", "国际展览中心"],
            "festival":   ["夫子庙景区", "玄武湖公园", "中山陵景区"],
        }
        return {
            "event": "new_event",
            "data": {
                "id": f"evt_manual_{int(time.time())}",
                "name": f"{random.choice(names[etype])}",
                "type": etype, "district": district["id"],
                "venue": random.choice(venues[etype]),
                "lat": district["lat"], "lng": district["lng"],
                "capacity": random.choice([5000, 10000, 20000, 30000, 50000, 60000]),
                "demandMultiplier": round(random.uniform(1.3, 3.8), 1),
                "confidence": round(random.uniform(0.82, 0.98), 2),
                "timestamp": ts,
            }
        }
    elif event_type == "social_spike":
        metrics = ["search_index", "topic_heat", "review_sentiment"]
        return {
            "event": "social_spike",
            "data": {
                "district": district["id"],
                "metric": random.choice(metrics),
                "value": random.randint(55, 95),
                "changePercent": random.randint(20, 60),
                "timestamp": ts,
            }
        }
    elif event_type == "status_change":
        s1 = random.choice(DEMAND_STATES[:3])
        s2 = random.choice([s for s in DEMAND_STATES if s != s1])
        return {
            "event": "status_change",
            "data": {
                "district": district["id"],
                "fromState": s1, "toState": s2,
                "confidence": round(random.uniform(0.85, 0.99), 2),
                "timestamp": ts,
            }
        }
    else:  # demand_update
        return {
            "event": "demand_update",
            "data": {
                "district": district["id"],
                "demandMultiplier": round(random.uniform(1.0, 4.0), 1),
                "state": random.choice(DEMAND_STATES),
                "hotels": district["hotels"],
                "timestamp": ts,
            }
        }


# ============================================================
# SSE 连接管理
# ============================================================
class SSEClient:
    """单个 SSE 客户端连接"""
    def __init__(self, wfile):
        self.wfile = wfile
        self._lock = threading.Lock()

    def send(self, event_type, data):
        """发送一条 SSE 消息"""
        msg = f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
        with self._lock:
            try:
                self.wfile.write(msg.encode("utf-8"))
                self.wfile.flush()
            except (BrokenPipeError, OSError):
                return False
        return True


class SSEManager:
    """管理所有 SSE 客户端连接"""
    def __init__(self):
        self._clients: list[SSEClient] = []
        self._lock = threading.Lock()

    def add(self, client):
        with self._lock:
            self._clients.append(client)

    def remove(self, client):
        with self._lock:
            if client in self._clients:
                self._clients.remove(client)

    def broadcast(self, event_type, data):
        """向所有客户端广播事件"""
        dead = []
        with self._lock:
            clients = list(self._clients)
        for c in clients:
            if not c.send(event_type, data):
                dead.append(c)
        with self._lock:
            for c in dead:
                if c in self._clients:
                    self._clients.remove(c)
        return len(clients) - len(dead)

    @property
    def count(self):
        with self._lock:
            return len(self._clients)


sse_manager = SSEManager()

# ============================================================
# 事件推送线程
# ============================================================
def timeline_pusher():
    """独立的 SSE 推送线程: 按时间线依次推送事件 + 定期心跳"""
    timeline = make_timeline()
    start_time = time.time()
    pushed = set()

    for entry in timeline:
        # 等待到指定延迟
        elapsed = time.time() - start_time
        wait = entry["delay"] - elapsed
        if wait > 0:
            time.sleep(wait)
        key = f"{entry['delay']}_{entry['event']}"
        if key in pushed:
            continue
        pushed.add(key)
        sse_manager.broadcast(entry["event"], entry["data"])

    # 时间线结束后保持心跳
    while True:
        time.sleep(15)
        sse_manager.broadcast("heartbeat",
            {"timestamp": _ts(time.time()), "timeline_complete": True})


# ============================================================
# HTTP 请求处理器
# ============================================================
class DemandHandler(http.server.BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        """自定义日志格式"""
        print(f"[{time.strftime('%H:%M:%S')}] {args[0]}")

    def do_GET(self):
        path = self.path.split("?")[0]  # 去掉 query string

        # ---- /trigger ----
        if path == "/trigger":
            ev = random_event()
            sse_manager.broadcast(ev["event"], ev["data"])
            self.send_json(200, {"status": "ok", "event": ev})
            return

        # ---- /events (SSE) ----
        if path == "/events":
            self.handle_sse()
            return

        # ---- 静态文件 ----
        if path == "/":
            path = "/index.html"

        file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                 path.lstrip("/"))

        if os.path.isfile(file_path):
            content_type, _ = mimetypes.guess_type(file_path)
            if content_type is None:
                content_type = "application/octet-stream"
            try:
                with open(file_path, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", len(content))
                self.end_headers()
                self.wfile.write(content)
            except OSError:
                self.send_error(500, "File read error")
        else:
            self.send_error(404, f"Not Found: {path}")

    def do_OPTIONS(self):
        """CORS preflight"""
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    def handle_sse(self):
        """建立 SSE 长连接"""
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.send_header("X-Accel-Buffering", "no")  # 禁用 nginx 缓冲
        self._cors_headers()
        self.end_headers()

        client = SSEClient(self.wfile)
        sse_manager.add(client)

        # 立即发送初始状态
        client.send("heartbeat", {
            "timestamp": _ts(time.time()),
            "active_events": 2,
            "message": "Connected to Demand Cognition Engine"
        })

        try:
            # 保持连接，等待客户端断开
            while True:
                time.sleep(5)
                # 检查连接是否还活着
                try:
                    self.wfile.flush()
                except (BrokenPipeError, OSError):
                    break
        finally:
            sse_manager.remove(client)

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", len(body))
        self._cors_headers()
        self.end_headers()
        self.wfile.write(body)


# ============================================================
# Threading HTTP Server
# ============================================================
class ThreadingHTTPServer(ThreadingMixIn, http.server.HTTPServer):
    """支持多线程的 HTTP Server (并发 SSE 连接 + 静态文件)"""
    daemon_threads = True


def main():
    server = ThreadingHTTPServer(("0.0.0.0", PORT), DemandHandler)

    # 启动 SSE 推送线程
    pusher = threading.Thread(target=timeline_pusher, daemon=True)
    pusher.start()

    print("=" * 60)
    print("  🏨 酒店需求认知模型 — SSE Server")
    print("  Demand Cognition Model Visualization Engine")
    print("=" * 60)
    print(f"  📡 Server:   http://localhost:{PORT}")
    print(f"  📡 SSE:      http://localhost:{PORT}/events")
    print(f"  ⚡ Trigger:  http://localhost:{PORT}/trigger")
    print(f"  ⏱️  Interval: {INTERVAL}s (timeline)")
    print(f"  🔗 Clients:  {sse_manager.count}")
    print("=" * 60)
    print("  Press Ctrl+C to stop")
    print()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        server.server_close()


if __name__ == "__main__":
    main()
