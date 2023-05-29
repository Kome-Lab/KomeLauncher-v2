/* eslint-disable solid/no-innerhtml */
/* eslint-disable i18next/no-literal-string */
import { Button } from "@gd/ui";
import { ModalProps, useModal } from "../..";
import ModalLayout from "../../ModalLayout";
import { FEMod } from "@gd/core_module/bindings";
import { Trans } from "@gd/i18n";
import { For, Match, Show, Switch, createEffect, createSignal } from "solid-js";
import { format } from "date-fns";
import { rspc } from "@/utils/rspcClient";

const ModDetails = (props: ModalProps) => {
  const modDetails = () => props.data?.mod as FEMod;
  const modId = () => modDetails()?.id;
  const modalsContext = useModal();
  const [modpackDescription, setModpackDescription] = createSignal("");

  createEffect(() => {
    if (modId()) {
      const modpackDescription = rspc.createQuery(() => [
        "modplatforms.curseforgeGetModDescription",
        { modId: modId() },
      ]);
      if (modpackDescription.data?.data)
        setModpackDescription(modpackDescription.data?.data);
    }
  });

  return (
    <ModalLayout noHeader={props.noHeader} title={props?.title}>
      <div class="h-130 w-190">
        <Switch>
          <Match when={props.data}>
            <div
              class="relative h-full bg-darkSlate-800 overflow-auto max-h-full overflow-x-hidden"
              style={{
                "scrollbar-gutter": "stable",
              }}
            >
              <div class="flex flex-col justify-between ease-in-out transition-all h-52 items-stretch">
                <div class="relative h-full">
                  <div
                    class="h-full absolute left-0 right-0 top-0 bg-fixed bg-cover bg-center bg-no-repeat"
                    style={{
                      "background-image": `url("${modDetails()?.logo?.url}")`,
                      "background-position": "right-5rem",
                    }}
                  />
                  <div class="z-10 top-5 sticky left-5 w-fit">
                    <Button
                      onClick={() => {
                        modalsContext?.openModal({ name: "addMod" });
                      }}
                      icon={<div class="text-2xl i-ri:arrow-drop-left-line" />}
                      size="small"
                      variant="transparent"
                    >
                      <Trans
                        key="instance.step_back"
                        options={{
                          defaultValue: "Back",
                        }}
                      />
                    </Button>
                  </div>
                  <div class="flex justify-center sticky px-4 h-24 top-52 z-20 bg-gradient-to-t from-darkSlate-800 from-10%">
                    <div class="flex gap-4 w-full lg:flex-row">
                      <div
                        class="bg-darkSlate-800 h-16 w-16 rounded-xl bg-center bg-cover"
                        style={{
                          "background-image": `url("${
                            modDetails()?.logo?.thumbnailUrl
                          }")`,
                        }}
                      />
                      <div class="flex flex-1 flex-col max-w-185">
                        <div class="flex gap-4 items-center cursor-pointer">
                          <h1 class="m-0 h-9">{modDetails()?.name}</h1>
                        </div>
                        <div class="flex flex-col lg:flex-row justify-between cursor-default">
                          <div class="flex flex-col lg:flex-row text-darkSlate-50 gap-1 items-start lg:items-center lg:gap-0">
                            <div class="p-0 lg:pr-4 border-0 lg:border-r-2 border-darkSlate-500">
                              {
                                modDetails()?.latestFilesIndexes?.[0]
                                  ?.gameVersion
                              }
                            </div>
                            <Show when={modDetails()?.dateCreated}>
                              <div class="p-0 border-0 lg:border-r-2 border-darkSlate-500 flex gap-2 items-center lg:px-4">
                                <div class="i-ri:time-fill" />

                                {format(
                                  new Date(modDetails()?.dateCreated).getTime(),
                                  "P"
                                )}
                              </div>
                            </Show>
                            <div class="p-0 lg:px-4 flex gap-2 items-center">
                              <div class="i-ri:user-fill" />
                              <div class="text-sm flex gap-2 overflow-x-auto whitespace-nowrap max-w-52">
                                <For each={modDetails()?.authors}>
                                  {(author) => <p class="m-0">{author.name}</p>}
                                </For>
                              </div>
                            </div>
                          </div>
                          <div class="flex items-center gap-2 mt-2 lg:mt-0">
                            <Button uppercase variant="glow" size="large">
                              <Trans
                                key="modpack.download"
                                options={{
                                  defaultValue: "Download",
                                }}
                              />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="p-4" innerHTML={modpackDescription()} />
            </div>
          </Match>
        </Switch>
      </div>
    </ModalLayout>
  );
};

export default ModDetails;
