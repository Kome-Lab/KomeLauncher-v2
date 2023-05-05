import {
  For,
  Match,
  Switch,
  createSignal,
  onCleanup,
  onMount,
  JSX,
} from "solid-js";

interface Marks {
  [mark: number]: string | { label: JSX.Element };
}
interface Props {
  max: number;
  min: number;
  steps?: number | null;
  marks: Marks;
  value?: number;
  onChange?: (_val: number) => void;
}

function Slider(props: Props) {
  const defaultValue = () => props.value;
  const min = () => props.min;
  const [currentValue, setCurrentValue] = createSignal<number>(
    defaultValue() || min()
  );
  const [startPosition, setStartPosition] = createSignal<number>(0);
  const [startValue, setStartValue] = createSignal<number>(0);
  const [dragging, setDragging] = createSignal(false);

  let handleRef: HTMLDivElement;
  let sliderRef: HTMLDivElement;

  const getSliderStart = () => {
    const rect = sliderRef.getBoundingClientRect();
    return rect.left;
  };

  const getSliderLength = () => {
    if (!sliderRef) {
      return 0;
    }

    return sliderRef.clientWidth;
  };

  const calcValue = (offset: number) => {
    const ratio = Math.abs(offset / getSliderLength());
    const value = ratio * (props.max - props.min) + props.min;
    return value;
  };

  const getPrecision = (step: number) => {
    const stepString = step.toString();
    let precision = 0;
    if (stepString.indexOf(".") >= 0) {
      precision = stepString.length - stepString.indexOf(".") - 1;
    }
    return precision;
  };

  const trimAlignValue = (v: number) => {
    let val = v;
    if (val <= props.min) {
      val = props.min;
    }
    if (val >= props.max) {
      val = props.max;
    }

    const points = Object.keys(props.marks).map(parseFloat);
    if (props.steps !== null && props.steps !== undefined) {
      const closestStep =
        Math.round((val - props.min) / props.steps) * props.steps + props.min;
      points.push(closestStep);
    }

    const diffs = points.map((point) => Math.abs(val - point));
    const closestPoint = points[diffs.indexOf(Math.min.apply(Math, diffs))];

    return props.steps !== null && props.steps !== undefined
      ? parseFloat(closestPoint.toFixed(getPrecision(props.steps)))
      : closestPoint;
  };

  const calcValueByPos = (position: number) => {
    const pixelOffset = position - getSliderStart();
    const nextValue = trimAlignValue(calcValue(pixelOffset));
    return nextValue;
  };

  const mousedown = (e: MouseEvent) => {
    e.preventDefault();

    const value = calcValueByPos(e.pageX);
    setDragging(true);
    setStartPosition(e.pageX);
    setStartValue(value);

    if (currentValue() !== value) {
      onChange(value);
    }
  };

  const onChange = (val: number) => {
    setCurrentValue(val);
    props?.onChange?.(val);
  };

  const mousemove = (e: MouseEvent) => {
    if (!dragging()) return;
    let diffPosition = e.pageX - startPosition();
    const diffValue =
      (diffPosition / getSliderLength()) * (props.max - props.min);

    const value = trimAlignValue(startValue() + diffValue);
    const oldValue = currentValue();
    if (value === oldValue) return;

    onChange(value);
  };

  const mouseup = () => {
    setDragging(false);
  };

  onMount(() => {
    handleRef.addEventListener("mousedown", mousedown);
    document.addEventListener("mousemove", mousemove);
    document.addEventListener("mouseup", mouseup);
  });

  onCleanup(() => {
    handleRef.removeEventListener("mousedown", mousedown);
    document.removeEventListener("mousemove", mousemove);
    document.removeEventListener("mouseup", mouseup);
  });

  const calcOffset = (value: number) => {
    const ratio = (value - props.min) / (props.max - props.min);
    return ratio * 100;
  };

  return (
    <div class="h-10 flex items-center w-full max-w-full box-border mb-10">
      <div class="relative w-full">
        <For each={Object.entries(props.marks)}>
          {([value, label], i) => (
            <>
              <div
                class="-top-1 w-2 h-2 rounded-full border-4 border-solid"
                style={{
                  position: "absolute",
                  left: `${calcOffset(parseInt(value, 10))}%`,
                  "margin-left": -(16 / 2) + "px",
                }}
                classList={{
                  "bg-darkSlate-900 border-darkSlate-900":
                    calcOffset(parseInt(value, 10)) >=
                    calcOffset(currentValue()),
                  "bg-primary-500 border-primary-500":
                    calcOffset(parseInt(value, 10)) <=
                    calcOffset(currentValue()),
                }}
              />
              <p
                class="flex flex-col -ml-2 mt-2 mb-0 text-xs text-darkSlate-500 w-10"
                style={{
                  position: "absolute",
                  left: `calc(${calcOffset(parseInt(value, 10))}% -  ${
                    i() === Object.entries(props.marks).length - 1
                      ? "10px"
                      : "0px"
                  })`,
                  top: "10px",
                }}
              >
                <Switch>
                  <Match when={typeof label === "string"}>{label}</Match>
                  <Match when={typeof label === "object"}>{label.label}</Match>
                </Switch>
              </p>
            </>
          )}
        </For>
        <div
          ref={(el) => {
            handleRef = el;
          }}
          class="w-4 h-4 bg-darkSlate-800 rounded-full border-4 border-solid border-primary-500 -top-2 cursor-move z-10"
          style={{
            position: "absolute",
            left: `${calcOffset(currentValue())}%`,
            transform: "translateX(-50%)",
          }}
        />
        <div
          class=" h-2 bg-primary-500 rounded-full"
          style={{
            position: "absolute",
            width: `${calcOffset(currentValue())}%`,
          }}
        />
        <div
          ref={(el) => {
            sliderRef = el;
          }}
          class="w-full h-2 bg-darkSlate-900 rounded-full"
        />
      </div>
    </div>
  );
}

export { Slider };
