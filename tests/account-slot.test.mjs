import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

test('SSR never exposes an account slot for the external view to mutate before hydration', () => {
  const source=readFileSync(new URL('../app/AccountSlot.tsx',import.meta.url),'utf8');
  const output=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const compiled={exports:{}};
  runInNewContext(output,{module:compiled,exports:compiled.exports,require:createRequire(import.meta.url)});
  assert.equal(renderToStaticMarkup(createElement(compiled.exports.AccountSlot,{'data-account-title':'Fixture'})),'');
  assert.match(source,/useSyncExternalStore\(subscribe, clientSnapshot, serverSnapshot\)/);
});

