#!/bin/sh
node ..\..\bin\typedoc --module commonjs --includeDeclarations --externalPattern **/lib/** --verbose --name "TypeDoc Documentation" --out doc/ ../../src/



