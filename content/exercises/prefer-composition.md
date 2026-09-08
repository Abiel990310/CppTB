---
id: prefer-composition
title: "Hold it, do not be it"
difficulty: core
chapter: composition-over-inheritance
topics: [design, composition, inheritance]
check: unit
standard: c++20
---

`Queue` inherits publicly from `std::vector<int>` to reuse its storage. As a
result every vector operation is part of `Queue`'s interface, so callers can
insert in the middle, index arbitrarily, and clear it — none of which a queue
should permit.

Rewrite it using composition. The public interface must be exactly:

- `push(int)` — add to the back
- `pop()` — remove and return the front, throwing `std::out_of_range` when empty
- `front()` — read the front without removing, throwing when empty
- `size()`, `empty()`

Nothing else may be reachable from outside.

## Starter
```cpp
#include <stdexcept>
#include <vector>

class Queue : public std::vector<int> {
public:
    void push(int value) { push_back(value); }

    int pop() {
        int value = front();
        erase(begin());
        return value;
    }
};
```

## Tests
```cpp
Queue q;
CHECK(q.empty());

q.push(1);
q.push(2);
q.push(3);
CHECK_EQ(q.size(), std::size_t{3});
CHECK(!q.empty());

CHECK_EQ(q.front(), 1);
CHECK_EQ(q.pop(), 1);
CHECK_EQ(q.pop(), 2);
CHECK_EQ(q.size(), std::size_t{1});
CHECK_EQ(q.front(), 3);

bool threw = false;
try { Queue{}.pop(); } catch (const std::out_of_range&) { threw = true; }
CHECK(threw);

bool front_threw = false;
try { Queue{}.front(); } catch (const std::out_of_range&) { front_threw = true; }
CHECK(front_threw);

// The vector interface must NOT be reachable. These would compile against the
// starter and must not compile against a correct solution:
static_assert(!std::is_base_of_v<std::vector<int>, Queue>,
              "Queue must hold a vector, not inherit from one");

Queue again;
for (int i = 0; i < 100; ++i) again.push(i);
CHECK_EQ(again.size(), std::size_t{100});
CHECK_EQ(again.pop(), 0);
CHECK_EQ(again.front(), 1);
```

## Hints
- Replace the base class with a private member: `std::vector<int> items_;`.
- Every public function then forwards to `items_`, which is the point — you choose what to expose.
- `front()` and `pop()` must check emptiness themselves; the starter relied on `std::vector::front`, which is undefined on an empty vector rather than throwing.
- `std::is_base_of_v` needs `<type_traits>`.
- Removing from the front of a vector is O(n). That is acceptable here; `std::deque` would be the better member if this were real.

## Solution
```cpp
#include <stdexcept>
#include <type_traits>
#include <vector>

class Queue {
public:
    void push(int value) { items_.push_back(value); }

    int pop() {
        if (items_.empty()) throw std::out_of_range("pop from an empty queue");
        const int value = items_.front();
        items_.erase(items_.begin());
        return value;
    }

    int front() const {
        if (items_.empty()) throw std::out_of_range("front of an empty queue");
        return items_.front();
    }

    std::size_t size() const { return items_.size(); }
    bool empty() const { return items_.empty(); }

private:
    std::vector<int> items_;
};
```

## Notes
The `static_assert` is the check that makes this a design exercise rather than a
rewrite. It fails to compile against any solution that still inherits, so
"forward the methods but keep the base" does not pass.

Look at what the empty-queue checks exposed. The starter called
`std::vector::front()` on an empty vector, which is **undefined behaviour**, not
an exception — so the original `pop()` on an empty queue read out of bounds
rather than throwing. Composition forced the question, because writing the
forwarding function is where you notice there is a precondition to enforce.

The O(n) erase from the front is the one honest weakness of the solution. Since
the vector is now a private implementation detail, swapping it for a
`std::deque` is a one-line change that no caller can observe — which is exactly
the freedom that public inheritance would have taken away.
