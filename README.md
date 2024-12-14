# dd-trace-js HTTP Headers bug

When an HTTP request is made using invalid HTTP headers (such as having a
newline in the header value), the `node:http` module will synchronously throw
and not actually initiate a request.

The `dd-trace` instrumentation has already started a trace by the time it
invokes the `http.request` function that throws this error, and marks the span
as errored when the exception is thrown. It also correctly bubbles up the error
for appropriate handling (in this example, it let's the express route return a
500 status code to the user).

However, that error handling does not mark the span finished, leaving the span
to stay open, and preventing the trace from being sent to the Agent. This means
these traces are not captured in DataDog, which means metrics and monitors based
on these trace errors do not work.

If a request is actually made, the `finish` behavior correctly finishes the
span, and marks the span as errored if appropriate.

[Instrumentation of error](https://github.com/DataDog/dd-trace-js/blob/c6defbc8b552bb152c87ea891337d1ccccfcb797/packages/datadog-instrumentations/src/http/client.js#L117-L120)

[Error handling](https://github.com/DataDog/dd-trace-js/blob/c6defbc8b552bb152c87ea891337d1ccccfcb797/packages/datadog-plugin-http/src/client.js#L113-L129)

# Reproduction

This repo intends to simulate the bug in a very simple fashion. It's an express
app with a single route that can demonstrate behaviors:

- return `HTTP 200` normally with no HTTP request
- query string `?error` will make a HTTP request that returns a 500 error
- query string `?badHeader` will make a HTTP request with a bad header value
  that will throw before making a request and demonstrate the issue.

Running with `DD_TRACE_ENABLED=true` shows logs of when dd-trace would have
submitted traces to the agent. For the happy path and HTTP 500 error cases,
trace submissions are logged and I can see the results in DataDog. For the bad
header case, nothing is logged that shows a trace submitted.

### Debug Logs

No HTTP request ("inject into carrier" omitted)

```
Encoding payload: 
[
  {
    "trace_id": "7ed96384fc560363",
    "span_id": "7ed96384fc560363",
    "parent_id": "0000000000000000",
    "name": "express.request",
    "resource": "GET",
    "error": 0,
    "meta": {
      "_dd.p.tid": "675de09d00000000",
      "_dd.p.dm": "-0",
      "service": "dd-trace-http-bug",
      "version": "1.0.0",
      "runtime-id": "66e825b7-b3a3-4773-aa92-3fbce5652f6d",
      "http.url": "http://localhost:3000/",
      "http.method": "GET",
      "span.kind": "server",
      "http.useragent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "component": "express",
      "http.status_code": "304",
      "language": "javascript"
    },
    "metrics": {
      "_dd.agent_psr": 1,
      "_dd.top_level": 1,
      "_dd.measured": 1,
      "process_id": 40749,
      "_sampling_priority_v1": 1
    },
    "start": 1734205597280015000,
    "duration": 5363770,
    "links": [],
    "service": "dd-trace-http-bug",
    "type": "web"
  },
  {
    "trace_id": "7ed96384fc560363",
    "span_id": "0bce7ee60c6d0056",
    "parent_id": "7ed96384fc560363",
    "name": "express.middleware",
    "resource": "query",
    "error": 0,
    "meta": {
      "service": "dd-trace-http-bug",
      "version": "1.0.0",
      "runtime-id": "66e825b7-b3a3-4773-aa92-3fbce5652f6d",
      "component": "express",
      "language": "javascript"
    },
    "metrics": {
      "process_id": 40749,
      "_sampling_priority_v1": 1
    },
    "start": 1734205597281138200,
    "duration": 339844,
    "links": [],
    "service": "dd-trace-http-bug"
  },
  {
    "trace_id": "7ed96384fc560363",
    "span_id": "380521cc0a07e65c",
    "parent_id": "7ed96384fc560363",
    "name": "express.middleware",
    "resource": "expressInit",
    "error": 0,
    "meta": {
      "service": "dd-trace-http-bug",
      "version": "1.0.0",
      "runtime-id": "66e825b7-b3a3-4773-aa92-3fbce5652f6d",
      "component": "express",
      "language": "javascript"
    },
    "metrics": {
      "process_id": 40749,
      "_sampling_priority_v1": 1
    },
    "start": 1734205597281570000,
    "duration": 102295,
    "links": [],
    "service": "dd-trace-http-bug"
  },
  {
    "trace_id": "7ed96384fc560363",
    "span_id": "06465589d9ba2b2f",
    "parent_id": "7ed96384fc560363",
    "name": "express.middleware",
    "resource": "bound dispatch",
    "error": 0,
    "meta": {
      "service": "dd-trace-http-bug",
      "version": "1.0.0",
      "runtime-id": "66e825b7-b3a3-4773-aa92-3fbce5652f6d",
      "component": "express",
      "language": "javascript"
    },
    "metrics": {
      "process_id": 40749,
      "_sampling_priority_v1": 1
    },
    "start": 1734205597281847000,
    "duration": 3589600,
    "links": [],
    "service": "dd-trace-http-bug"
  },
  {
    "trace_id": "7ed96384fc560363",
    "span_id": "40c3dbc1e2af8837",
    "parent_id": "06465589d9ba2b2f",
    "name": "express.middleware",
    "resource": "<anonymous>",
    "error": 0,
    "meta": {
      "service": "dd-trace-http-bug",
      "version": "1.0.0",
      "runtime-id": "66e825b7-b3a3-4773-aa92-3fbce5652f6d",
      "component": "express",
      "language": "javascript"
    },
    "metrics": {
      "process_id": 40749,
      "_sampling_priority_v1": 1
    },
    "start": 1734205597281930000,
    "duration": 3492920,
    "links": [],
    "service": "dd-trace-http-bug"
  }
]


Request to the agent:
{
  "path": "/v0.4/traces",
  "method": "PUT",
  "headers": {
    "Content-Type": "application/msgpack",
    "Datadog-Meta-Tracer-Version": "5.28.0",
    "X-Datadog-Trace-Count": "1",
    "Datadog-Meta-Lang": "nodejs",
    "Datadog-Meta-Lang-Version": "v20.12.1",
    "Datadog-Meta-Lang-Interpreter": "v8"
  },
  "url": "http://127.0.0.1:8126/"
}
```

HTTP request 500 error ("inject into carrier" omitted)

```
Encoding payload:
[
  {
    "trace_id": "25f1a26110b848d3",
    "span_id": "25f1a26110b848d3",
    "parent_id": "0000000000000000",
    "name": "express.request",
    "resource": "GET",
    "error": 1,
    "meta": {
      "_dd.p.tid": "675de16400000000",
      "_dd.p.dm": "-0",
      "service": "dd-trace-http-bug",
      "version": "1.0.0",
      "runtime-id": "36e8a1dc-7960-4544-bf98-901a705aeedc",
      "http.url": "http://localhost:3000/?error",
      "http.method": "GET",
      "span.kind": "server",
      "http.useragent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "component": "express",
      "http.status_code": "500",
      "language": "javascript"
    },
    "metrics": {
      "_dd.agent_psr": 1,
      "_dd.top_level": 1,
      "_dd.measured": 1,
      "process_id": 41087,
      "_sampling_priority_v1": 1
    },
    "start": 1734205796869016300,
    "duration": 406335205,
    "links": [],
    "service": "dd-trace-http-bug",
    "type": "web"
  },
  {
    "trace_id": "25f1a26110b848d3",
    "span_id": "4a4d9b85910dcadc",
    "parent_id": "25f1a26110b848d3",
    "name": "express.middleware",
    "resource": "query",
    "error": 0,
    "meta": {
      "service": "dd-trace-http-bug",
      "version": "1.0.0",
      "runtime-id": "36e8a1dc-7960-4544-bf98-901a705aeedc",
      "component": "express",
      "language": "javascript"
    },
    "metrics": {
      "process_id": 41087,
      "_sampling_priority_v1": 1
    },
    "start": 1734205796870711300,
    "duration": 672852,
    "links": [],
    "service": "dd-trace-http-bug"
  },
  {
    "trace_id": "25f1a26110b848d3",
    "span_id": "5faf74be873c6bfe",
    "parent_id": "25f1a26110b848d3",
    "name": "express.middleware",
    "resource": "expressInit",
    "error": 0,
    "meta": {
      "service": "dd-trace-http-bug",
      "version": "1.0.0",
      "runtime-id": "36e8a1dc-7960-4544-bf98-901a705aeedc",
      "component": "express",
      "language": "javascript"
    },
    "metrics": {
      "process_id": 41087,
      "_sampling_priority_v1": 1
    },
    "start": 1734205796871480800,
    "duration": 103027,
    "links": [],
    "service": "dd-trace-http-bug"
  },
  {
    "trace_id": "25f1a26110b848d3",
    "span_id": "03777adb12dc111b",
    "parent_id": "25f1a26110b848d3",
    "name": "express.middleware",
    "resource": "bound dispatch",
    "error": 0,
    "meta": {
      "service": "dd-trace-http-bug",
      "version": "1.0.0",
      "runtime-id": "36e8a1dc-7960-4544-bf98-901a705aeedc",
      "component": "express",
      "language": "javascript"
    },
    "metrics": {
      "process_id": 41087,
      "_sampling_priority_v1": 1
    },
    "start": 1734205796871726000,
    "duration": 403748535,
    "links": [],
    "service": "dd-trace-http-bug"
  },
  {
    "trace_id": "25f1a26110b848d3",
    "span_id": "068e9ee631564502",
    "parent_id": "03777adb12dc111b",
    "name": "express.middleware",
    "resource": "<anonymous>",
    "error": 0,
    "meta": {
      "service": "dd-trace-http-bug",
      "version": "1.0.0",
      "runtime-id": "36e8a1dc-7960-4544-bf98-901a705aeedc",
      "component": "express",
      "language": "javascript"
    },
    "metrics": {
      "process_id": 41087,
      "_sampling_priority_v1": 1
    },
    "start": 1734205796871813600,
    "duration": 403650391,
    "links": [],
    "service": "dd-trace-http-bug"
  },
  {
    "trace_id": "25f1a26110b848d3",
    "span_id": "71a340e331091c81",
    "parent_id": "068e9ee631564502",
    "name": "http.request",
    "resource": "GET",
    "error": 0,
    "meta": {
      "service": "dd-trace-http-bug",
      "version": "1.0.0",
      "runtime-id": "36e8a1dc-7960-4544-bf98-901a705aeedc",
      "component": "http",
      "span.kind": "client",
      "http.method": "GET",
      "http.url": "https://httpbin.org/status/500",
      "out.host": "httpbin.org",
      "http.status_code": "500",
      "language": "javascript"
    },
    "metrics": {
      "_dd.measured": 1,
      "process_id": 41087,
      "_sampling_priority_v1": 1
    },
    "start": 1734205796874662700,
    "duration": 392656738,
    "links": [],
    "service": "dd-trace-http-bug",
    "type": "http"
  },
  {
    "trace_id": "25f1a26110b848d3",
    "span_id": "110f8cb154603b7c",
    "parent_id": "71a340e331091c81",
    "name": "tcp.connect",
    "resource": "httpbin.org:443",
    "error": 0,
    "meta": {
      "service": "dd-trace-http-bug",
      "version": "1.0.0",
      "runtime-id": "36e8a1dc-7960-4544-bf98-901a705aeedc",
      "component": "net",
      "span.kind": "client",
      "tcp.remote.host": "httpbin.org",
      "tcp.family": "IPv4",
      "tcp.local.address": "192.168.1.155",
      "out.host": "httpbin.org",
      "language": "javascript"
    },
    "metrics": {
      "_dd.measured": 1,
      "tcp.remote.port": 443,
      "tcp.local.port": 60109,
      "network.destination.port": 443,
      "process_id": 41087,
      "_sampling_priority_v1": 1
    },
    "start": 1734205796893602000,
    "duration": 115083252,
    "links": [],
    "service": "dd-trace-http-bug"
  },
  {
    "trace_id": "25f1a26110b848d3",
    "span_id": "78f90ace880c463e",
    "parent_id": "110f8cb154603b7c",
    "name": "dns.lookup",
    "resource": "httpbin.org",
    "error": 0,
    "meta": {
      "service": "dd-trace-http-bug",
      "version": "1.0.0",
      "runtime-id": "36e8a1dc-7960-4544-bf98-901a705aeedc",
      "component": "dns",
      "span.kind": "client",
      "dns.hostname": "httpbin.org",
      "dns.address": "34.226.108.155",
      "dns.addresses": "34.226.108.155,44.196.3.45",
      "language": "javascript"
    },
    "metrics": {
      "_dd.measured": 1,
      "process_id": 41087,
      "_sampling_priority_v1": 1
    },
    "start": 1734205796893983500,
    "duration": 36298584,
    "links": [],
    "service": "dd-trace-http-bug"
  }
]

Request to the agent:
{
  "path": "/v0.4/traces",
  "method": "PUT",
  "headers": {
    "Content-Type": "application/msgpack",
    "Datadog-Meta-Tracer-Version": "5.28.0",
    "X-Datadog-Trace-Count": "1",
    "Datadog-Meta-Lang": "nodejs",
    "Datadog-Meta-Lang-Version": "v20.12.1",
    "Datadog-Meta-Lang-Interpreter": "v8"
  },
  "url": "http://127.0.0.1:8126/"
}
```

BadHeader error:

```
Inject into carrier:
{
  "x-datadog-trace-id": "4665840146013984426",
  "x-datadog-parent-id": "308009029936780685",
  "x-datadog-sampling-priority": "1"
}.

Flushing 0 metrics via HTTP
...
```




