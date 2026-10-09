from typing import List, Tuple


class GraphVerifierEngine:
    """
    Deterministic Polynomial-Time Verification Engine for NP-Complete Graph Problems.
    Runs verification in O(n^2) steps.
    """

    def __init__(self, num_vertices: int, edges: List[Tuple[int, int]]):
        self.n = num_vertices
        self.edges = edges

        # Adjacency set for O(1) edge verification and O(|V| + |E|) space
        self.adj_set = [set() for _ in range(self.n)]
        for u, v in edges:
            if 0 <= u < self.n and 0 <= v < self.n:
                self.adj_set[u].add(v)
                self.adj_set[v].add(u)

    def verify_clique(self, candidate: List[int], k: int) -> Tuple[bool, str]:
        """Verifies if 'candidate' is a valid Clique of size >= k in O(|C|^2) <= O(n^2) steps."""
        cert_set = set(candidate)

        # Step 1: Check size constraint
        if len(cert_set) < k:
            return False, f"REJECT: Certificate size ({len(cert_set)}) is smaller than required k={k}."

        # Step 2: Validate vertex bounds
        for v in cert_set:
            if v < 0 or v >= self.n:
                return False, f"REJECT: Vertex {v} is outside valid range [0, {self.n - 1}]."

        # Step 3: Check pairwise connectivity (All pairs must have an edge)
        cert_list = list(cert_set)
        for i in range(len(cert_list)):
            for j in range(i + 1, len(cert_list)):
                u, v = cert_list[i], cert_list[j]
                if v not in self.adj_set[u]:
                    return False, f"REJECT: Missing edge between vertex {u} and vertex {v}."

        return True, f"ACCEPT: Candidate {candidate} is a VALID Clique of size {len(cert_set)} >= {k}."

    def verify_vertex_cover(self, candidate: List[int], k: int) -> Tuple[bool, str]:
        """Verifies if 'candidate' is a valid Vertex Cover of size <= k in O(|E|) <= O(n^2) steps."""
        cert_set = set(candidate)

        # Step 1: Check size constraint
        if len(cert_set) > k:
            return False, f"REJECT: Certificate size ({len(cert_set)}) exceeds maximum allowed k={k}."

        # Step 2: Validate vertex bounds
        for v in cert_set:
            if v < 0 or v >= self.n:
                return False, f"REJECT: Vertex {v} is outside valid range [0, {self.n - 1}]."

        # Step 3: Check edge coverage (Every edge must touch at least one candidate vertex)
        for u, v in self.edges:
            if u not in cert_set and v not in cert_set:
                return False, f"REJECT: Edge ({u}, {v}) is NOT covered by any vertex in candidate."

        return True, f"ACCEPT: Candidate {candidate} is a VALID Vertex Cover of size {len(cert_set)} <= {k}."


# ==========================================================
# DEFAULT INSTANCE
# Every prompt below shows a [default] value. Pressing Enter
# accepts it, so the engine can be demonstrated with no input.
# The default instance is a valid certificate for BOTH
# problems, which keeps the demo consistent when the user
# switches the problem type.
# ==========================================================
DEFAULT_NUM_VERTICES = 6
DEFAULT_EDGES: List[Tuple[int, int]] = [
    (0, 1),
    (1, 2),
    (0, 2),
    (0, 3),
    (1, 4),
]
DEFAULT_CHOICE = "1"
DEFAULT_K = 3
DEFAULT_CANDIDATE: List[int] = [0, 1, 2]


def _format_default(value) -> str:
    if isinstance(value, tuple):
        return " ".join(str(part) for part in value)
    if isinstance(value, list):
        return " ".join(str(part) for part in value)
    return str(value)


def ask(prompt, default, cast=str, validate=None, display=None):
    """Prompt with a visible default. An empty answer accepts the default."""
    shown = _format_default(default) if display is None else display

    while True:
        try:
            raw = input(f"{prompt} [{shown}]: ").strip()
        except EOFError:
            print()
            return default

        if not raw:
            return default

        try:
            value = cast(raw)
        except ValueError:
            print(f"  '{raw}' is not valid here. Expected something like '{shown}'.")
            print("  Press Enter to accept the default.")
            continue

        if validate is not None and not validate(value):
            print(f"  '{raw}' is out of range. Press Enter to accept the default ({shown}).")
            continue

        return value


def ask_edge(index, total):
    """Prompt for one edge pair, defaulting to the built-in sample graph."""
    if index < len(DEFAULT_EDGES):
        default = DEFAULT_EDGES[index]
    else:
        default = (0, index % max(DEFAULT_NUM_VERTICES, 1))

    shown = _format_default(default)

    while True:
        try:
            raw = input(f"  Edge {index + 1}/{total} (u v) [{shown}]: ").strip()
        except EOFError:
            print()
            return default

        if not raw:
            return default

        parts = raw.replace(",", " ").split()

        if len(parts) == 2:
            try:
                return (int(parts[0]), int(parts[1]))
            except ValueError:
                pass

        print(f"  '{raw}' is not a valid edge. Expected two integers such as '{shown}'.")
        print("  Press Enter to accept the default.")


def parse_certificate(raw):
    """Accept a certificate as '0 1 2' or '0,1,2'."""
    return [int(token) for token in raw.replace(",", " ").split()]


# ==========================================================
# INTERACTIVE RUNTIME INPUT ENGINE
# ==========================================================
def main():
    print("==================================================")
    print("      NP-COMPLETE GRAPH VERIFIER ENGINE           ")
    print("==================================================\n")
    print("Every prompt shows a [default] value. Press Enter to accept it,")
    print("or just press Enter on every line to run the default instance.\n")

    try:
        # Step 1: Input Graph Setup
        num_vertices = ask(
            "Enter total number of vertices (|V|)",
            DEFAULT_NUM_VERTICES,
            int,
            validate=lambda n: n >= 1,
        )

        num_edges = ask(
            "Enter total number of edges (|E|)",
            len(DEFAULT_EDGES),
            int,
            validate=lambda n: n >= 0,
        )

        print("\nEnter each edge as two space-separated integers (e.g., '0 1'):")
        edges = [ask_edge(i, num_edges) for i in range(num_edges)]

        # Initialize engine
        engine = GraphVerifierEngine(num_vertices, edges)

        # Step 2: Input Verification Parameters
        print("\nChoose Problem Type to Verify:")
        print("  1) Clique Problem")
        print("  2) Vertex Cover Problem")
        choice = ask(
            "Enter choice (1 or 2)",
            DEFAULT_CHOICE,
            str,
            validate=lambda c: c in {"1", "2"},
        )

        k = ask(
            "\nEnter target size parameter (k)",
            DEFAULT_K,
            int,
            validate=lambda n: n >= 0,
        )

        candidate = ask(
            "Enter candidate certificate vertices separated by spaces (e.g., '0 1 2')",
            DEFAULT_CANDIDATE,
            parse_certificate,
        )

        # Step 3: Run Verification
        print("\n---------------- RESULTS ----------------")
        if choice == '1':
            is_valid, msg = engine.verify_clique(candidate, k)
            print(f"Problem: CLIQUE (Target size >= {k})")
        else:
            is_valid, msg = engine.verify_vertex_cover(candidate, k)
            print(f"Problem: VERTEX COVER (Target size <= {k})")

        print(f"Status : {'[ PASSED ]' if is_valid else '[ FAILED ]'}")
        print(f"Details: {msg}")
        print("------------------------------------------")

    except ValueError as e:
        print(f"\n[INPUT ERROR] Invalid input format. Please enter numeric values where required.")
    except Exception as e:
        print(f"\n[ERROR] {e}")


if __name__ == "__main__":
    main()