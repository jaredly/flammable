
MULTI='spec=- html-cov=cov.html json-cov=cov.json'
MOCHA=multi=${MULTI} ./node_modules/.bin/mocha \
      --require babel-core/browser-polyfill \
      --require patched-blanket -R mocha-multi

test:
	./node_modules/.bin/mocha --compilers 'js:./test/babel' -R spec test

utils:
	./node_modules/.bin/mocha --compilers 'js:./test/babel' \
		-R spec test/utils.js

test-cov:
	babel-node node_modules/.bin/isparta cover --report text \
		--report html node_modules/.bin/_mocha \
		-- --reporter spec ./test/flux.js ./test/events.js \
				   ./test/react.js ./test/utils.js
	cp istanbulcss/* coverage

old-test-cov: b-test b-lib
	${MOCHA} build/test

B_TEST=$(patsubst %,build/%, $(filter-out test/babel.js test/webpack.config.js, $(wildcard test/*.js)))
B_LIB=$(patsubst %,build/%, $(wildcard src/*.js) $(wildcard *.js))
L_SRC=$(patsubst src/%,lib/%, $(wildcard src/*.js) $(wildcard *.js))

lib:
	mkdir -p lib

transpile: lib ${L_SRC}

build/%.js: %.js
	babel --stage 0 $< -d build

lib/%.js: src/%.js
	babel --stage 0 $< > $@

b-test: ${B_TEST}

b-lib: ${B_LIB}

.PHONY: test
