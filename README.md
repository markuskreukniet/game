# game

## Units and Dimensional Analysis

### Why are some values in px/s²? An example:

```
In 'vy += gravity * dt;' is vy in px/s and dt in s.
gravity * dt = vy. gravity * s = px/s
gravity = px/s / s. gravity = px/s * 1/s. gravity = px/s²
```

### Why are some values in px/s? An example:

```
In 'brakingDelta = groundDeceleration * dt;' is groundDeceleration in px/s² and dt in s.
groundDeceleration * dt = brakingDelta. px/s² * s = brakingDelta
px/s² * s = px / (s * s) * s = px * s / (s * s) = (px / s) * (s / s) = px / s
```

## TODO:

- add and use a config
- add fall multiplier?
- input reset should trigger once

- do more like this const p = world.player. + remove some abstraction?
- should numbers like 255 be an constant? don't use / 2, but use _ 0.5. Abstract _ dpi and \* dt duplicates?
