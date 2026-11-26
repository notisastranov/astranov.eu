"""Run on the monitored computer. Install psutil with: python -m pip install psutil"""
import json
import math
import os
import subprocess
from pathlib import Path
import time

import psutil


def sensor(name):
    try:
        return getattr(psutil, name, lambda: None)()
    except (OSError, NotImplementedError, psutil.Error):
        return None


def temperature():
    readings = sensor("sensors_temperatures") or {}
    sensors = [s for group in readings.values() for s in group
               if s.current is not None and math.isfinite(s.current) and 0 < s.current < 150]
    if not sensors:
        if os.name == "nt":
            # LibreHardwareMonitor publishes CPU sensors through this WMI provider.
            command = ("Get-CimInstance -Namespace root/LibreHardwareMonitor -ClassName Sensor "
                       "-ErrorAction Stop | Where-Object {$_.SensorType -eq 'Temperature' "
                       "-and $_.Identifier -match 'cpu'} | Measure-Object Value -Maximum | "
                       "Select-Object -ExpandProperty Maximum")
            try:
                output = subprocess.check_output(["powershell.exe", "-NoProfile", "-NonInteractive",
                                                  "-Command", command], stderr=subprocess.DEVNULL,
                                                 timeout=4, text=True)
                value = float(output.strip().replace(",", "."))
                if 0 < value < 150:
                    return value, 85
            except (OSError, ValueError, subprocess.SubprocessError):
                pass
        return None, None
    hottest = max(sensors, key=lambda s: s.current)
    return hottest.current, hottest.high or hottest.critical or 85


def main():
    destination = Path.cwd() / "astranov-resources.json"
    print(f"Select {destination} in Device resources. Press Ctrl+C to stop.", flush=True)
    previous = psutil.net_io_counters(pernic=True)
    last = time.monotonic()
    next_temperature = 0
    temp, limit = None, None
    while True:
        cpu = psutil.cpu_percent(interval=1)
        now = time.monotonic()
        current = psutil.net_io_counters(pernic=True)
        stats = psutil.net_if_stats()
        traffic = []
        for name, value in current.items():
            if name not in previous or name not in stats or not stats[name].isup or name.startswith("lo"):
                continue
            old = previous[name]
            mbps = max(0, value.bytes_recv-old.bytes_recv, value.bytes_sent-old.bytes_sent)*8/(now-last)/1e6
            traffic.append((mbps, stats[name].speed))
        rate, speed = max(traffic, default=(None, 0))
        previous, last = current, now
        battery = sensor("sensors_battery")
        if now >= next_temperature:
            temp, limit = temperature()
            next_temperature = now + 10
        data = dict(format="astranov-resources-v1", timestamp=time.time(),
                    cpu=cpu, ram=psutil.virtual_memory().percent, mbps=rate,
                    network_percent=min(100, 100*rate/speed) if speed > 0 else None,
                    battery=battery.percent if battery else None,
                    charging=battery.power_plugged if battery else None,
                    temperature=temp, temperature_limit=limit)
        temp_path = destination.with_suffix(".tmp")
        temp_path.write_text(json.dumps(data, allow_nan=False), encoding="utf-8")
        temp_path.replace(destination)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
