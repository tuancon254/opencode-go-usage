# opencode-go-usage

OpenCode TUI plugin: hiển thị hạn mức dùng **opencode-go** (rolling 5h / weekly / monthly) ngay trong sidebar.

```
OpenCode Go
5h    ░░░░░░░░░░   0% · 1h 21m
Week  ███░░░░░░░  25% · 4d 11h
Month █░░░░░░░░░  12% · 24d 6h
```

## Cài

Khai báo trong `~/.config/opencode/opencode.json` (hoặc `opencode.jsonc`):

### Từ GitHub

```jsonc
{
  "plugins": [
    {
      "package": "github:tuancon254/opencode-go-usage",
      "options": {
        "refreshMs": 30000
      }
    }
  ]
}
```

### Từ thư mục local (để dev)

```jsonc
{
  "plugins": [
    {
      "package": "D:/plugin/opencode-usage-go",
      "options": {
        "refreshMs": 30000
      }
    }
  ]
}
```

Restart opencode là xong. Không cần build, không cần publish lên npm.

### Vì sao cần cả `index.ts` lẫn `tui.ts`

Package khai trong `opencode.json` được **server** load trước, rồi CLI lấy phần TUI (`./tui`) từ chính package đó. Nên phải có cả hai entrypoint:

- `index.ts` — server plugin, no-op. Không có nó thì server không có entrypoint `.` để load, và plugin không xuất hiện trong `opencode plugin list`.
- `tui.ts` — phần thật sự vẽ sidebar.

`cli.json` (`plugins[]`) là lựa chọn khác, dành cho plugin **chỉ chạy local** — vẫn hoạt động khi CLI connect tới remote server. Với background service local thì hai cách cho kết quả giống nhau.

## API key

Tự động lấy theo thứ tự:

1. `options.apiKey`
2. `OPENCODE_AUTH_CONTENT` (file auth opencode inject vào)
3. `auth.json` trong các data dir của opencode — duyệt lần lượt, không dừng ở cái đầu tiên
4. `OPENCODE_API_KEY`

Bình thường mày chỉ cần đăng nhập opencode-go là có key, không phải config gì thêm.

### Vì sao phải duyệt nhiều data dir

opencode lưu `auth.json` ở **`~/.local/share/opencode` trên mọi platform, kể cả Windows** — không phải `%APPDATA%`. Nhưng terminal trên Windows thường để `HOME` rỗng, nên phải dùng `USERPROFILE`.

Vì vậy `datadir.ts` sinh danh sách theo thứ tự ưu tiên, bỏ qua cái không tồn tại:

1. `$XDG_DATA_HOME/opencode` (nếu có)
2. `~/.local/share/opencode` — vị trí thật của opencode
3. `~/Library/Application Support/opencode` (macOS bản cũ)
4. `%APPDATA%\opencode` (Windows native)

Trên máy Windows thường sẽ ra:
```
FOUND   C:\Users\<you>/.local/share/opencode/auth.json
miss    C:\Users\<you>/Library/Application Support/opencode/auth.json
miss    C:\Users\<you>/AppData/Roaming/opencode/auth.json
```

## Options

| Option | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `refreshMs` | `30000` | chu kỳ fetch lại (ms) |
| `timeoutMs` | `10000` | timeout mỗi request (ms) |
| `apiKey` | — | ghi đè key |
| `dataDir` | tự suy ra | ghi đè thư mục chứa `auth.json` |

## Hành vi

- Luôn hiện usage của opencode-go, kể cả khi session đang chạy model của provider khác (ví dụ `openai/gpt-5.5`). Hạn mức go là của account, không phụ thuộc model đang chạy.
- Refresh theo interval + ngay khi có `session.execution.succeeded`.
- Lỗi không chặn UI: 401 → `auth failed`, mất mạng → `unavailable (offline)`, không có key → `no api key`. Nếu đã có số liệu cũ thì giữ số cũ và đánh dấu `stale`.
- Màu thanh theo ngưỡng: xanh `<50%`, hổ phách `50–74`, cam sáng `75–99`, đỏ `100%`. Lấy từ theme token (`text.feedback.*`) nên tự đúng ở cả light lẫn dark.

## Cấu trúc

| File | Việc |
| --- | --- |
| `index.ts` | server entry, no-op. Chỉ cần để package load được từ `opencode.json`. |
| `usage.ts` | parse payload + format bar/countdown/màu. Thuần, không I/O. |
| `key.ts` | tìm API key trong các auth store. Thuần ngoài `readFileSync`. |
| `datadir.ts` | sinh danh sách data dir opencode có thể dùng. Thuần. |
| `tui.ts` | fetch, signal, slot, cleanup. |

## Test

```sh
bun run check    # tsc --noEmit && bun test
```

38 test: `usage.test.ts` + `key.test.ts` + `datadir.test.ts` chạy logic thuần; `tui.test.ts` render cây thật qua OpenTUI (`testRender` + `captureCharFrame`) với `fetch` bị stub, khẳng định đúng ký tự xuất hiện trên màn hình.

Cần **bun** chứ không phải node cho `tui.test.ts`: OpenTUI dùng native FFI nên không chạy được dưới node.
