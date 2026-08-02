# Metrics

The Worker stores allowlisted action names for 35 days. Every event contains only a SHA-256 hash of a random browser UUID, event name, QA flag, and Unix timestamp.

| Event               | Meaning                                        |
| ------------------- | ---------------------------------------------- |
| `visited`           | page client started                            |
| `category_selected` | a major industry was selected                  |
| `searched`          | a distinct local query returned results        |
| `no_result`         | a distinct local query returned no results     |
| `level_changed`     | hierarchy display changed                      |
| `saved`             | a classification was added to the local bundle |
| `copied`            | a code, record, or bundle was copied           |
| `official_opened`   | an e-Stat detail page was opened               |
| `returned`          | visitor returned after at least eight hours    |

`?qa=1` and browser automation set the QA header. QA rows are reported separately and never count as users.
