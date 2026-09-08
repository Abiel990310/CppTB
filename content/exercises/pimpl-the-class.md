---
id: pimpl-the-class
title: "One pointer wide"
difficulty: stretch
chapter: inlining-and-linking
topics: [pimpl, compilation, smart-pointers, special-members]
check: unit
standard: c++20
---

`Document` currently exposes its whole implementation in what would be its
header: a `std::string` and a `std::vector<std::string>` as members. Every file
that includes it therefore includes `<string>` and `<vector>`, and every change
to those members rebuilds all of them.

Rewrite it with the **pointer to implementation** idiom: the class holds one
`std::unique_ptr<Impl>` and nothing else, `Impl` is declared in the class but
defined below it, and every member function is defined out of line.

The public behaviour must not change — including value semantics, so copying a
`Document` must produce an independent one.

## Starter
```cpp
#include <cstddef>
#include <memory>
#include <string>
#include <utility>
#include <vector>

class Document {
public:
    Document() = default;
    explicit Document(std::string title) : title_(std::move(title)) {}

    void add_line(std::string line) { lines_.push_back(std::move(line)); }
    std::size_t line_count() const { return lines_.size(); }
    const std::string& title() const { return title_; }

    std::string render() const {
        std::string out = title_ + "\n";
        for (const std::string& line : lines_) { out += line; out += '\n'; }
        return out;
    }

private:
    std::string title_;
    std::vector<std::string> lines_;
};
```

## Tests
```cpp
// The whole point: the class is exactly one pointer wide.
static_assert(sizeof(Document) == sizeof(void*),
              "Document should hold nothing but a pointer to its implementation");

// Moving must still be cheap and noexcept — a container of Documents depends on it.
static_assert(std::is_nothrow_move_constructible_v<Document>);
static_assert(std::is_nothrow_move_assignable_v<Document>);

// It must still be a value type.
static_assert(std::is_copy_constructible_v<Document>);
static_assert(std::is_copy_assignable_v<Document>);

Document empty;
CHECK_EQ(empty.line_count(), std::size_t{0});
CHECK_EQ(empty.title(), std::string(""));

Document report{"Report"};
report.add_line("one");
report.add_line("two");
CHECK_EQ(report.line_count(), std::size_t{2});
CHECK_EQ(report.title(), std::string("Report"));
CHECK_EQ(report.render(), std::string("Report\none\ntwo\n"));

// A copy must be independent, not a second handle on the same lines.
Document copy = report;
copy.add_line("three");
CHECK_EQ(report.line_count(), std::size_t{2});
CHECK_EQ(copy.line_count(), std::size_t{3});
CHECK_EQ(copy.render(), std::string("Report\none\ntwo\nthree\n"));

// Copy assignment, including onto a non-empty target.
Document target{"Other"};
target.add_line("discarded");
target = report;
CHECK_EQ(target.line_count(), std::size_t{2});
CHECK_EQ(target.title(), std::string("Report"));

// Self-assignment must not corrupt anything.
target = target;
CHECK_EQ(target.line_count(), std::size_t{2});

// Moving transfers, and the source stays destructible.
Document moved = std::move(copy);
CHECK_EQ(moved.line_count(), std::size_t{3});

// And it works in a container, which is what the noexcept move buys.
std::vector<Document> documents;
documents.push_back(report);
documents.push_back(Document{"Second"});
documents.emplace_back("Third");
CHECK_EQ(documents.size(), std::size_t{3});
CHECK_EQ(documents[0].line_count(), std::size_t{2});
CHECK_EQ(documents[2].title(), std::string("Third"));
```

## Hints
- Declare `struct Impl;` inside the class and define it *after* the class body. The members move into it.
- The single data member is `std::unique_ptr<Impl> impl_;`.
- `std::unique_ptr<Impl>` with an **incomplete** `Impl` compiles in the class body but not in an implicitly generated destructor — the deleter needs the complete type. So you must **declare** `~Document();` in the class and **define** it (`= default` is fine) after `Impl` is defined. This is the single most common PIMPL mistake.
- The same applies to the move constructor and move assignment: declare them in the class, define them as `= default` below. Declaring the destructor also suppresses the implicit moves, so you have to bring them back.
- The copy constructor cannot be defaulted at all — `unique_ptr` is not copyable. Write it: allocate a new `Impl` copy-constructed from the source's.
- Copy assignment is easiest as `*impl_ = *other.impl_;` with a self-assignment guard, which reuses the existing allocation.
- `std::make_unique<Impl>(*other.impl_)` copy-constructs an `Impl` on the heap in one expression.

## Solution
```cpp
#include <cstddef>
#include <memory>
#include <string>
#include <utility>
#include <vector>

// --- what the header would contain -----------------------------------
class Document {
public:
    Document();
    explicit Document(std::string title);
    ~Document();                              // declared here, defined below

    Document(const Document& other);
    Document& operator=(const Document& other);
    Document(Document&& other) noexcept;
    Document& operator=(Document&& other) noexcept;

    void add_line(std::string line);
    std::size_t line_count() const;
    const std::string& title() const;
    std::string render() const;

private:
    struct Impl;                              // declared, not defined
    std::unique_ptr<Impl> impl_;
};

// --- what the .cpp would contain -------------------------------------
struct Document::Impl {
    std::string title;
    std::vector<std::string> lines;
};

Document::Document() : impl_(std::make_unique<Impl>()) {}

Document::Document(std::string title) : impl_(std::make_unique<Impl>()) {
    impl_->title = std::move(title);
}

Document::~Document() = default;              // Impl is complete here

Document::Document(const Document& other) : impl_(std::make_unique<Impl>(*other.impl_)) {}

Document& Document::operator=(const Document& other) {
    if (this != &other) *impl_ = *other.impl_;
    return *this;
}

Document::Document(Document&& other) noexcept = default;
Document& Document::operator=(Document&& other) noexcept = default;

void Document::add_line(std::string line) { impl_->lines.push_back(std::move(line)); }

std::size_t Document::line_count() const { return impl_->lines.size(); }

const std::string& Document::title() const { return impl_->title; }

std::string Document::render() const {
    std::string out = impl_->title + "\n";
    for (const std::string& line : impl_->lines) { out += line; out += '\n'; }
    return out;
}
```

## Notes
The payoff is invisible in this file, because there is only one. Split it as
intended and the header names `std::unique_ptr` and `std::string` for the
constructor parameter and nothing else — no `<vector>`, no knowledge of what
`Impl` holds. Add a field to `Impl`, change its data structure, replace the
vector with a rope: not one file that includes the header recompiles. That is
the *compilation firewall*, and on a large codebase it is the difference between
a five-second rebuild and a five-minute one.

The destructor is the trap everyone hits once. `std::unique_ptr<Impl>` only
needs `Impl` to be complete where the deleter is *instantiated* — which is
inside the destructor. Let the compiler generate that destructor implicitly and
it gets generated in the header, where `Impl` is still incomplete, and you get
a page of template errors ending in "invalid application of `sizeof` to an
incomplete type". Declaring `~Document();` moves the generation below the
definition of `Impl`, where it is fine.

And declaring a destructor has a knock-on effect, straight out of Chapter 3.5:
it suppresses the implicit move constructor and move assignment. Without the two
`= default` declarations, `Document` would still compile and would silently
*copy* on every move — including on every `std::vector` reallocation. The
`is_nothrow_move_constructible_v` assertion in the checks is what catches that.

The costs are real and worth stating, because PIMPL is over-applied. Every
`Document` is a heap allocation. Every member call is a pointer indirection.
None of the accessors can be inlined into a caller in another file, because
their bodies are no longer in the header — which is the entire point, and also
the entire cost. Use it for the types at the boundaries of a library that many
files depend on. Do not use it for a `Point`.
