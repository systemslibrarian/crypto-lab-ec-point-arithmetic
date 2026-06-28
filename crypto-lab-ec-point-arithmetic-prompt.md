# Prompt: Create "crypto-lab-ec-point-arithmetic" Demo

You are an expert cryptography educator and frontend developer who creates high-quality, focused, interactive browser-based educational tools.

## Project Goal

Create a new standalone browser demo called **Elliptic Curve Point Arithmetic** that helps students build strong visual and intuitive understanding of how elliptic curves work — specifically point addition and scalar multiplication — which form the foundation of modern elliptic curve cryptography (ECDSA, ECDH, etc.).

## Why This Is Valuable for Students

Elliptic curve cryptography is used everywhere (TLS, Bitcoin, SSH, Signal, etc.), but most students only see the equations without developing real intuition for what is actually happening geometrically on the curve.

A good interactive visualizer allows students to:

- See point addition as a geometric operation (drawing lines and reflecting)
- Understand why scalar multiplication is efficient but reversing it (the elliptic curve discrete logarithm problem) is hard
- Build mental models that make ECDSA and ECDH much easier to understand later
- Appreciate why certain curves were chosen and why some are considered safer than others

This kind of visual, hands-on experience is extremely effective for building lasting intuition.

## Learning Objectives

By using this demo, a student should be able to:

- Perform point addition on an elliptic curve visually and algebraically
- Understand scalar multiplication as repeated point addition
- Explain why computing `k × P` is easy but finding `k` given `P` and `k × P` is hard
- Recognize the geometric meaning behind the group law on elliptic curves
- See how different curves behave (e.g., secp256k1 vs a toy curve)

## Required Sections & Flow

### 1. Introduction to Elliptic Curves

- Simple, clear explanation of the curve equation (Weierstrass form).
- Show a visual of a typical elliptic curve over the reals.
- Brief note on working over finite fields (which is what real cryptography uses).

### 2. Interactive Point Addition Visualizer (Core Feature)

- User can click two points on the curve (or have them randomly generated).
- The demo draws the line between them, finds the third intersection point, and reflects it to show the sum.
- Show both the geometric construction **and** the algebraic formulas side-by-side.
- Allow users to drag points and see the result update live.

### 3. Scalar Multiplication

- User chooses a point P and a scalar k.
- Show the step-by-step process of computing k × P using repeated addition (or double-and-add for efficiency).
- Visualize the resulting point on the curve.
- Include a “step through” mode so students can see each doubling and addition.

### 4. The Hard Problem (ECDLP)

- Show that while computing k × P is fast, reversing it (finding k) is believed to be extremely difficult.
- Simple visualization or explanation of why brute force and baby-step giant-step become impractical quickly.
- Contrast with small toy curves vs real cryptographic curves.

### 5. Comparison of Curves (Optional but Recommended)

- Side-by-side or selectable view of different curves (e.g., a small educational curve vs secp256k1).
- Highlight differences in shape, order, and security properties at a high level.

## Technical Preferences

- Browser-native with good visual quality (Canvas or SVG recommended for the curve and point drawing).
- Support for both real-number visualization (for teaching geometry) and finite-field arithmetic (for realism).
- Default to a small, easy-to-understand curve for interactivity, with an option to switch to a real curve like secp256k1.
- Clean, focused, educational aesthetic consistent with Crypto Lab demos.
- Strong emphasis on visual clarity and step-by-step interaction.

## Relationship to Existing Work

- This should complement (not duplicate) the existing `Curve Lens` demo.
- The focus here is specifically on **point arithmetic intuition** rather than higher-level curve properties or attacks.
- It can serve as a foundation that links to ECDSA Forge, ECDH-related demos, and Bitcoin Wallet mechanics.

## Output Requested

Please provide:

1. A recommended final display title for the demo page
2. High-level architecture and component breakdown
3. Key interactive elements and how the visualization should behave
4. Suggested UI layout and visual design approach
5. Technical recommendations for rendering the curve and handling finite-field arithmetic in the browser
6. Any important pedagogical notes (e.g., real vs toy curves, when to show formulas vs geometry)

Start with the proposed structure, then we can iterate on implementation details.
