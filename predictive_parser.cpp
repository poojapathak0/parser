/*
 * Non-Recursive Predictive Parser (LL(1)) for:
 *   S  -> A B C
 *   A  -> abA | ab
 *   B  -> b | BC       (left-recursive)
 *   C  -> c | cC
 *
 * Steps performed:
 *   1. Left-factor A; remove left recursion from B; left-factor B, C
 *   2. Compute FIRST and FOLLOW sets
 *   3. Build predictive parsing table M[NT][terminal]
 *   4. Run non-recursive predictive parser on "abbcc"
 */

#include <iostream>
#include <map>
#include <stack>
#include <string>
#include <vector>
#include <iomanip>

// ─── helpers ─────────────────────────────────────────────────────────────────

// Non-terminals used in the transformed grammar
const std::vector<std::string> NTs = {"S","A","A'","B","B'","C","C'"};
// Terminals (including end-marker)
const std::vector<char> Terms = {'a','b','c','$'};

// ─── 1. Print the transformed grammar ─────────────────────────────────────────

void printGrammar()
{
    std::cout << "=== TRANSFORMED (LL(1)) GRAMMAR ===\n"
              << "  (original left recursion in B removed; A and C left-factored)\n\n"
              << "  S  -> A B C\n"
              << "  A  -> ab A'\n"
              << "  A' -> ab A'  |  ε\n"
              << "  B  -> b B'\n"
              << "  B' -> C B'   |  ε\n"
              << "  C  -> c C'\n"
              << "  C' -> c C'   |  ε\n\n"
              << "  (Note: M[B',c] has a conflict: both B'->CB' and B'->ε belong\n"
              << "   there because FIRST(C)={c} and FOLLOW(B')={c}. Resolved here\n"
              << "   by choosing B'->ε so that 'abbcc' is correctly accepted.\n"
              << "   Choosing B'->CB' greedily would consume C's into B and leave\n"
              << "   the final S->ABC's C without input. The conflict reflects the\n"
              << "   inherent ambiguity of the original B -> b | BC production.)\n\n";
}

// ─── 2. Print FIRST sets ──────────────────────────────────────────────────────
/*
 * FIRST(S)  = {a}          (S -> ABC, A starts with 'a')
 * FIRST(A)  = {a}          (A -> abA')
 * FIRST(A') = {a, ε}       (A' -> abA' | ε)
 * FIRST(B)  = {b}          (B -> bB')
 * FIRST(B') = {c, ε}       (B' -> CB' | ε;  FIRST(C)={c})
 * FIRST(C)  = {c}          (C -> cC')
 * FIRST(C') = {c, ε}       (C' -> cC' | ε)
 */
void printFirst()
{
    std::cout << "=== FIRST SETS ===\n"
              << "  FIRST(S)  = { a }\n"
              << "  FIRST(A)  = { a }\n"
              << "  FIRST(A') = { a, ε }\n"
              << "  FIRST(B)  = { b }\n"
              << "  FIRST(B') = { c, ε }\n"
              << "  FIRST(C)  = { c }\n"
              << "  FIRST(C') = { c, ε }\n\n";
}

// ─── 3. Print FOLLOW sets ─────────────────────────────────────────────────────
/*
 * FOLLOW(S)  = {$}
 * FOLLOW(A)  = FIRST(BC) = FIRST(B) = {b}
 * FOLLOW(A') = FOLLOW(A) = {b}
 * FOLLOW(B)  = FIRST(C)  = {c}         (C does not derive ε)
 * FOLLOW(B') = FOLLOW(B) = {c}
 * FOLLOW(C)  = FOLLOW(S) ∪ (FIRST(B')-{ε}) ∪ FOLLOW(B')
 *            = {$} ∪ {c} ∪ {c} = {$, c}
 *            Explanation: C appears (a) at end of S->ABC => FOLLOW(S)={$}
 *                         (b) in B'->CB', followed by B' => FIRST(B')-ε={c},
 *                             and B' can be ε => also FOLLOW(B')={c}
 * FOLLOW(C') = FOLLOW(C) = {$, c}
 */
void printFollow()
{
    std::cout << "=== FOLLOW SETS ===\n"
              << "  FOLLOW(S)  = { $ }\n"
              << "  FOLLOW(A)  = { b }\n"
              << "  FOLLOW(A') = { b }\n"
              << "  FOLLOW(B)  = { c }\n"
              << "  FOLLOW(B') = { c }\n"
              << "  FOLLOW(C)  = { $, c }\n"
              << "  FOLLOW(C') = { $, c }\n\n";
}

// ─── 4. Build and print the parsing table ────────────────────────────────────
/*
 * Rules applied:
 *   For A -> α: add M[A,t] = α  for t in FIRST(α)-{ε}
 *               if ε in FIRST(α): add M[A,t] = ε for t in FOLLOW(A)
 *
 * Table (row = NT, col = terminal):
 *         a          b          c          $
 *  S   | S->ABC   |           |           |
 *  A   | A->abA'  |           |           |
 *  A'  | A'->abA' | A'->ε    |           |
 *  B   |          | B->bB'   |           |
 *  B'  |          |          | B'->ε *   |        (* conflict resolved -> ε)
 *  C   |          |          | C->cC'   |
 *  C'  |          |          | C'->cC'  | C'->ε
 */

// M[nt][terminal] -> production RHS string ("" = error, "eps" = epsilon)
std::map<std::string, std::map<char,std::string>> buildTable()
{
    std::map<std::string, std::map<char,std::string>> M;

    M["S"]['a']  = "ABC";

    M["A"]['a']  = "abA'";

    M["A'"]['a'] = "abA'";
    M["A'"]['b'] = "eps";       // A' -> ε  (FOLLOW: b)

    M["B"]['b']  = "bB'";

    // Conflict at M[B',c]: both B'->CB' and B'->ε.
    // Resolved to ε so that the 'c's are left for the outer C in S->ABC.
    M["B'"]['c'] = "eps";       // B' -> ε  (conflict resolved)

    M["C"]['c']  = "cC'";

    M["C'"]['c'] = "cC'";       // prefer non-ε (greedy: consume remaining c's)
    M["C'"]['$'] = "eps";       // C' -> ε  (FOLLOW: $)

    return M;
}

void printTable(const std::map<std::string, std::map<char,std::string>>& M)
{
    std::cout << "=== PARSING TABLE M[NT, terminal] ===\n";
    std::cout << std::left
              << std::setw(6) << "NT"
              << std::setw(14) << "a"
              << std::setw(14) << "b"
              << std::setw(16) << "c"
              << std::setw(14) << "$" << "\n";
    std::cout << std::string(64,'-') << "\n";

    auto cell = [&](const std::string& nt, char t) -> std::string {
        auto it = M.find(nt);
        if (it == M.end()) return "-";
        auto it2 = it->second.find(t);
        if (it2 == it->second.end()) return "-";
        if (it2->second == "eps") return nt+"->e";
        return nt+"->"+it2->second;
    };

    for (const auto& nt : NTs) {
        std::cout << std::left << std::setw(6) << nt
                  << std::setw(14) << cell(nt,'a')
                  << std::setw(14) << cell(nt,'b')
                  << std::setw(16) << cell(nt,'c')
                  << std::setw(14) << cell(nt,'$') << "\n";
    }
    std::cout << "\n  (e = epsilon,  - = error/blank)\n"
              << "  (*) M[B',c] = B'->e  (conflict resolved; see grammar note)\n\n";
}

// ─── 5 & 6. Non-recursive predictive parser ──────────────────────────────────

// Returns true if the NT symbol table should be consulted (false = terminal)
bool isNT(const std::string& sym)
{
    for (const auto& nt : NTs)
        if (sym == nt) return true;
    return false;
}

// Expand production string into symbols pushed onto the stack (right-to-left)
// e.g. "abA'" -> push "A'", 'b', 'a'  so that 'a' is on top
void pushRHS(std::stack<std::string>& stk, const std::string& rhs)
{
    if (rhs == "eps") return;           // epsilon -> push nothing

    // Split rhs into symbols: upper+' is a 2-char NT, else single char
    std::vector<std::string> syms;
    for (size_t i = 0; i < rhs.size(); ) {
        if (i+1 < rhs.size() && rhs[i+1] == '\'') {
            syms.push_back(rhs.substr(i, 2));
            i += 2;
        } else {
            syms.push_back(std::string(1, rhs[i]));
            i += 1;
        }
    }
    for (int i = (int)syms.size()-1; i >= 0; --i)
        stk.push(syms[i]);
}

void runParser(const std::map<std::string, std::map<char,std::string>>& M,
               const std::string& input)
{
    std::cout << "=== PARSING TRACE for \"" << input << "\" ===\n";
    std::cout << std::left
              << std::setw(30) << "Stack (top->bottom)"
              << std::setw(20) << "Remaining Input"
              << "Action\n"
              << std::string(80,'-') << "\n";

    std::string inp = input + "$";
    size_t pos = 0;

    std::stack<std::string> stk;
    stk.push("$");
    stk.push("S");

    bool accepted = false;
    bool error    = false;

    // Helper: print current stack (top first)
    auto stackStr = [&]() -> std::string {
        std::stack<std::string> tmp = stk;
        std::string s;
        while (!tmp.empty()) { s += tmp.top(); tmp.pop(); }
        return s;
    };

    while (!stk.empty() && !error) {
        std::string top  = stk.top();
        char        curr = inp[pos];

        std::string stackS = stackStr();
        std::string restS  = inp.substr(pos);

        if (top == "$") {
            if (curr == '$') {
                std::cout << std::setw(30) << stackS
                          << std::setw(20) << restS
                          << "ACCEPT\n";
                accepted = true;
                break;
            } else {
                std::cout << std::setw(30) << stackS
                          << std::setw(20) << restS
                          << "ERROR: stack empty, input not consumed\n";
                error = true;
                break;
            }
        }

        if (!isNT(top)) {
            // top is a terminal symbol
            if (top[0] == curr) {
                std::cout << std::setw(30) << stackS
                          << std::setw(20) << restS
                          << "match '" << curr << "'\n";
                stk.pop();
                ++pos;
            } else {
                std::cout << std::setw(30) << stackS
                          << std::setw(20) << restS
                          << "ERROR: expected '" << top[0]
                          << "', got '" << curr << "'\n";
                error = true;
            }
        } else {
            // top is a non-terminal: look up table
            auto it = M.find(top);
            if (it == M.end() || it->second.find(curr) == it->second.end()) {
                std::cout << std::setw(30) << stackS
                          << std::setw(20) << restS
                          << "ERROR: no rule M[" << top << ","
                          << curr << "]\n";
                error = true;
            } else {
                const std::string& rhs = it->second.at(curr);
                std::string action = top + " -> " + (rhs=="eps"?"ε":rhs);
                std::cout << std::setw(30) << stackS
                          << std::setw(20) << restS
                          << action << "\n";
                stk.pop();
                pushRHS(stk, rhs);
            }
        }
    }

    std::cout << "\n=== RESULT: "
              << (accepted ? "ACCEPTED" : "REJECTED") << " ===\n";
}

// ─── main ────────────────────────────────────────────────────────────────────

int main()
{
    std::cout << "=========================================================\n"
              << "  Non-Recursive Predictive Parser (LL(1)) Demo\n"
              << "  Input string: \"abbcc\"\n"
              << "=========================================================\n\n";

    printGrammar();
    printFirst();
    printFollow();

    auto M = buildTable();
    printTable(M);

    runParser(M, "abbcc");

    return 0;
}
