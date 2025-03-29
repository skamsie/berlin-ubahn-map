.PHONY: swipl
swipl:
	@command -v swipl >/dev/null 2>&1 || { \
			echo >&2 "❌ SWI-Prolog (swipl) is not installed."; \
			echo >&2 "💡 Install it first and run this command again"; \
			exit 1; \
		}
setup: swipl
	@git clone https://github.com/skamsie/berlin-subway.git && \
		cd berlin-subway && \
		swipl --stand_alone=true -o route_finder -c main.pl && \
		cp route_finder .. && \
		cd .. && \
		rm -rf berlin-subway
run:
	go run server.go
