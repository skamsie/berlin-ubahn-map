.PHONY: all swipl setup run build

all: setup build

swipl:
	@command -v swipl >/dev/null 2>&1 || { \
		echo >&2 "❌ SWI-Prolog (swipl) is not installed."; \
		echo >&2 "💡 Install it first and run this command again"; \
		exit 1; \
	}

setup: swipl
	@echo "🛠️ Building ./route_finder from https://github.com/skamsie/berlin-subway.git"
	@git clone https://github.com/skamsie/berlin-subway.git && \
		cd berlin-subway && \
		swipl --stand_alone=true -o route_finder -c main.pl && \
		cp route_finder .. && \
		cd .. && \
		rm -rf berlin-subway
	@echo "✅ Build complete: ./route_finder"

run:
	go run server.go

build:
	@echo "🛠️ Building ubahn-map-server for local OS..."
	@OS=$$(uname -s | tr '[:upper:]' '[:lower:]'); \
	case "$$OS" in \
		darwin)  GOOS=darwin ;; \
		linux)   GOOS=linux ;; \
		msys*|mingw*|cygwin*) GOOS=windows ;; \
		*) echo "❌ Unsupported OS: $$OS"; exit 1 ;; \
	esac; \
	GOARCH=amd64; \
	echo "📦 GOOS=$$GOOS GOARCH=$$GOARCH"; \
	go build -o ubahn-map-server -ldflags="-s -w" server.go; \
	echo "✅ Build complete: ./ubahn-map-server"
