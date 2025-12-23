#!/bin/bash
# Polly - Mobile Testing Startup Script
# Detects host IP and starts Docker with correct BASE_URL for QR codes
#
# Usage:
#   ./start-mobile.sh        # Start with auto-detected IP
#   ./start-mobile.sh demo   # Start with demo data
#   ./start-mobile.sh stop   # Stop the containers

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

# Detect OS type
detect_os() {
  case "$(uname -s)" in
    Darwin*) echo "macos" ;;
    Linux*)  echo "linux" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *) echo "unknown" ;;
  esac
}

# Detect local network IP (runs on HOST, not in container)
detect_host_ip() {
  local IP=""
  local OS=$(detect_os)
  
  case "$OS" in
    macos)
      # macOS: Try all active network interfaces
      for iface in $(networksetup -listallhardwareports 2>/dev/null | grep "Device:" | awk '{print $2}'); do
        IP=$(ipconfig getifaddr "$iface" 2>/dev/null || echo "")
        if [ -n "$IP" ] && ! echo "$IP" | grep -q "^127\."; then
          break
        fi
      done
      # Fallback: try common interfaces
      if [ -z "$IP" ]; then
        for iface in en0 en1 en2 en3 en4 en5; do
          IP=$(ipconfig getifaddr "$iface" 2>/dev/null || echo "")
          if [ -n "$IP" ] && ! echo "$IP" | grep -q "^127\."; then
            break
          fi
        done
      fi
      ;;
      
    linux)
      # Check if running in WSL (needs Windows host IP for mobile access)
      if grep -qi microsoft /proc/version 2>/dev/null; then
        echo -e "${YELLOW}Detected WSL environment - getting Windows host IP${NC}" >&2
        # In WSL, get the Windows host IP from physical adapters only (not virtual)
        # NOTE: 172.x is valid for corporate LANs, so we filter by adapter name, not IP range
        if command -v powershell.exe &> /dev/null; then
          IP=$(powershell.exe -NoProfile -Command "
            \$physicalAdapters = Get-NetAdapter | Where-Object { 
              \$_.Status -eq 'Up' -and 
              \$_.InterfaceDescription -notmatch 'Virtual|Hyper-V|vEthernet|WSL|VPN|TAP|TUN|Bluetooth'
            } | Select-Object -ExpandProperty Name
            
            if (\$physicalAdapters) {
              Get-NetIPAddress -AddressFamily IPv4 | 
              Where-Object { 
                \$_.InterfaceAlias -in \$physicalAdapters -and
                \$_.IPAddress -notmatch '^169\.' -and 
                \$_.IPAddress -notmatch '^127\.'
              } | 
              Select-Object -First 1 -ExpandProperty IPAddress
            }
          " 2>/dev/null | tr -d '\r\n')
        fi
        
        # If WSL detection failed to get Windows IP, force manual entry
        if [ -z "$IP" ]; then
          echo -e "${YELLOW}Could not auto-detect Windows host IP from WSL.${NC}" >&2
          echo -e "${YELLOW}Please enter your Windows IP manually.${NC}" >&2
        fi
      fi
      
      # Regular Linux detection if not WSL or WSL detection failed
      if [ -z "$IP" ]; then
        # Linux Method 1: Default route (most reliable)
        IP=$(ip route get 1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if ($i=="src") print $(i+1)}' | head -1)
      fi
      # Linux Method 2: hostname -I
      if [ -z "$IP" ]; then
        IP=$(hostname -I 2>/dev/null | awk '{print $1}')
      fi
      # Linux Method 3: Parse ip addr
      if [ -z "$IP" ]; then
        IP=$(ip addr show 2>/dev/null | grep 'inet ' | grep -v '127.0.0.1' | awk '{print $2}' | cut -d/ -f1 | head -1)
      fi
      ;;
      
    windows)
      # Windows: Get IP from physical network adapters only (Wi-Fi/Ethernet)
      # Uses Get-NetAdapter to filter by physical adapter status first
      # NOTE: 172.x is valid for corporate LANs, so we filter by adapter name, not IP range
      if command -v powershell.exe &> /dev/null; then
        IP=$(powershell.exe -NoProfile -Command "
          \$physicalAdapters = Get-NetAdapter | Where-Object { 
            \$_.Status -eq 'Up' -and 
            \$_.InterfaceDescription -notmatch 'Virtual|Hyper-V|vEthernet|WSL|VPN|TAP|TUN|Bluetooth'
          } | Select-Object -ExpandProperty Name
          
          if (\$physicalAdapters) {
            Get-NetIPAddress -AddressFamily IPv4 | 
            Where-Object { 
              \$_.InterfaceAlias -in \$physicalAdapters -and
              \$_.IPAddress -notmatch '^169\.' -and 
              \$_.IPAddress -notmatch '^127\.'
            } | 
            Select-Object -First 1 -ExpandProperty IPAddress
          }
        " 2>/dev/null | tr -d '\r\n')
      fi
      # Fallback: Parse ipconfig output for Ethernet/Wi-Fi adapters
      if [ -z "$IP" ]; then
        IP=$(ipconfig.exe 2>/dev/null | grep -A5 -E "^Ethernet adapter|^Wireless LAN adapter Wi-Fi" | grep -E "IPv4.*: [0-9]" | grep -v "169\." | head -1 | awk -F': ' '{print $2}' | tr -d '\r')
      fi
      ;;
  esac
  
  # Final fallback: try generic methods
  if [ -z "$IP" ]; then
    IP=$(hostname -i 2>/dev/null | awk '{print $1}' || echo "")
  fi
  
  echo "$IP"
}

# Get port from docker-compose.yml or default
PORT="${APP_PORT:-3080}"

# Handle commands
case "$1" in
  stop)
    echo -e "${YELLOW}Stopping Polly...${NC}"
    docker compose down
    exit 0
    ;;
  demo)
    SEED_DEMO="true"
    ;;
  *)
    SEED_DEMO="false"
    ;;
esac

# Detect IP
HOST_IP=$(detect_host_ip)

# Function to prompt for manual IP
prompt_for_ip() {
  echo -e "${YELLOW}Enter your host IP address (e.g., 192.168.1.100):${NC}"
  read -r MANUAL_IP
  if [ -n "$MANUAL_IP" ]; then
    HOST_IP="$MANUAL_IP"
  fi
}

# Handle detection failure
if [ -z "$HOST_IP" ] || echo "$HOST_IP" | grep -q "^127\."; then
  echo -e "${YELLOW}⚠️  Could not auto-detect host IP${NC}"
  prompt_for_ip
  
  if [ -z "$HOST_IP" ] || echo "$HOST_IP" | grep -q "^127\."; then
    echo -e "${YELLOW}No valid IP provided. Exiting.${NC}"
    echo "You can also set BASE_URL manually:"
    echo "  BASE_URL=http://YOUR_IP:${PORT} docker compose up -d"
    exit 1
  fi
fi

# Display detected IP and ask for confirmation
echo -e "${GREEN}🏫 Polly - Mobile Testing Mode${NC}"
echo ""
echo -e "📱 Detected IP: ${GREEN}${HOST_IP}${NC}"
echo ""
echo "Is this correct? Your phone must be able to reach this IP."
echo "(Press Enter to accept, or type a different IP address)"
echo ""
read -r CONFIRM_IP

if [ -n "$CONFIRM_IP" ]; then
  # User provided a different IP - validate it
  if echo "$CONFIRM_IP" | grep -qE "^127\."; then
    echo -e "${YELLOW}localhost (127.x) won't work from mobile devices.${NC}"
    echo "Please restart and enter your LAN IP."
    exit 1
  fi
  HOST_IP="$CONFIRM_IP"
  echo -e "Using IP: ${GREEN}${HOST_IP}${NC}"
fi

BASE_URL="http://${HOST_IP}:${PORT}"

echo ""
echo -e "🔗 BASE_URL: ${GREEN}${BASE_URL}${NC}"
echo ""
echo "QR codes and share links will use this address."
echo "Make sure your phone is on the same network!"
echo ""

# Start Docker with detected IP
if [ "$SEED_DEMO" = "true" ]; then
  echo -e "${GREEN}Starting with demo data...${NC}"
  BASE_URL="$BASE_URL" APP_URL="$BASE_URL" VITE_APP_URL="$BASE_URL" SEED_DEMO_DATA=true docker compose up -d
else
  echo -e "${GREEN}Starting...${NC}"
  BASE_URL="$BASE_URL" APP_URL="$BASE_URL" VITE_APP_URL="$BASE_URL" docker compose up -d
fi

echo ""
echo -e "${GREEN}✅ Polly is running!${NC}"
echo ""
echo -e "🌐 Open in browser: ${GREEN}${BASE_URL}${NC}"
echo -e "📱 Scan QR codes with your phone to test"
echo ""
echo "Default login: admin / Admin123!"
