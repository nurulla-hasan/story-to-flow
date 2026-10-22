# OmniRoute probe results

2026-10-22T05:54:05.011Z

| model | test | ok | latency | notes |
| --- | --- | --- | --- | --- |
| agy/gemini-3.8-flash-high | planner: Bangla text | PASS | 8124 ms | ভোরের সোনালি রোদে কুয়াশাভেজা শান্ত জল, নোঙর করা নৌকা আর মানুষের স্নিগ্ধ আনাগোনায় সকালের নদীর ঘাটটি |
| agy/gemini-3.8-flash-high | planner: JSON only | PASS | 4136 ms | fences=false; parsed=yes; raw={"ok":true,"word":"বাংলা"} |
| agy/gemini-3.8-flash-low | validator: Bangla text | PASS | 2937 ms | ভোরের নরম আলোয় কুয়াশাচ্ছন্ন নদীর ঘাটটিতে মৃদু কলতান আর মানুষের শান্ত উপস্থিতিতে এক অপরূপ স্নিগ্ধ প |
| agy/gemini-3.8-flash-low | validator: JSON only | PASS | 5129 ms | fences=false; parsed=yes; raw={"ok":true,"word":"বাংলা"} |
| ollamacloud/gemma4:31b | fallback: Bangla text | PASS | 1051 ms | সকালবেলা নদীর ঘাট শান্ত, স্নিগ্ধ এবং উদীয়মান সূর্যের আলোয় ঝলমলে দেখায়। |
| ollamacloud/gemma4:31b | fallback: JSON only | PASS | 864 ms | fences=false; parsed=yes; raw={"ok":true,"word":"বাংলা"} |
| agy/gemini-3.8-flash-high | image generation | FAIL | 0 ms | No image came back from OmniRoute. images/generations 400: {"error":{"message":"Invalid image model: agy/gemini-3.8-flash-high. Use format: provider/model","type":"invalid_request_error","code":"bad_request"}}; chat responded but contained no image ({"id":"chatcmpl-1792648444987-e627ad6b","object":" |

Base URL: http://localhost:20128/v1
API key present: yes

## Image provider default

`manual`
