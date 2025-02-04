/* eslint-disable i18next/no-literal-string */
import { getCFModloaderIcon } from "@/utils/sidebar";
import {
  ListInstance,
  CFFEModLoaderType,
  FESubtask,
  Translation
} from "@gd/core_module/bindings";
import { For, Match, Show, Switch, createSignal, mergeProps } from "solid-js";
import { Trans, useTransContext } from "@gd/i18n";
import { rspc } from "@/utils/rspcClient";
import { ContextMenu, Popover, Spinner, Tooltip } from "@gd/ui";
import DefaultImg from "/assets/images/default-instance-img.png";
import { useGDNavigate } from "@/managers/NavigationManager";
import { useModal } from "@/managers/ModalsManager";
import { getModpackPlatformIcon } from "@/utils/instances";
import { setInstanceId } from "@/utils/browser";
import {
  setExportStep,
  setPayload
} from "@/managers/ModalsManager/modals/InstanceExport";
import { setCheckedFiles } from "@/managers/ModalsManager/modals/InstanceExport/atoms/ExportCheckboxParent";

type Variant = "default" | "sidebar" | "sidebar-small";

type Props = {
  modloader: CFFEModLoaderType | null | undefined;
  instance: ListInstance;
  selected?: boolean;
  isLoading?: boolean;
  percentage?: number;
  version: string | undefined | null;
  img: string | undefined;
  variant?: Variant;
  isInvalid?: boolean;
  downloaded?: number;
  totalDownload?: number;
  isRunning?: boolean;
  isPreparing?: boolean;
  isDeleting?: boolean;
  subTasks?: FESubtask[] | undefined;
  failError?: string;
  onClick?: (_e: MouseEvent) => void;
  size: 1 | 2 | 3 | 4 | 5;
};

const Tile = (props: Props) => {
  const mergedProps = mergeProps(
    { variant: "default", isLoading: false },
    props
  );

  const [copiedError, setCopiedError] = createSignal(false);

  const rspcContext = rspc.useContext();
  const [t] = useTransContext();
  const navigate = useGDNavigate();
  const modalsContext = useModal();

  const launchInstanceMutation = rspc.createMutation(() => ({
    mutationKey: ["instance.launchInstance"]
  }));

  const killInstanceMutation = rspc.createMutation(() => ({
    mutationKey: ["instance.killInstance"]
  }));

  const openFolderMutation = rspc.createMutation(() => ({
    mutationKey: ["instance.openInstanceFolder"]
  }));

  const duplicateInstanceMutation = rspc.createMutation(() => ({
    mutationKey: ["instance.duplicateInstance"]
  }));

  const handleOpenFolder = () => {
    openFolderMutation.mutate({
      instance_id: props.instance.id,
      folder: "Root"
    });
  };

  const handlePlay = () => {
    launchInstanceMutation.mutate(props.instance.id);
  };

  const handleDelete = () => {
    // deleteInstanceMutation.mutate(props.instance.id);
    modalsContext?.openModal(
      {
        name: "confirmInstanceDeletion"
      },
      {
        id: props.instance.id,
        name: props.instance.name
      }
    );
  };

  const handleSettings = () => {
    navigate(`/library/${props.instance.id}/settings`);
  };

  const validInstance = () =>
    props.instance.status.status === "valid"
      ? props.instance.status.value
      : undefined;

  const handleEdit = async () => {
    const instanceDetails = await rspcContext.client.query([
      "instance.getInstanceDetails",
      props.instance.id
    ]);

    modalsContext?.openModal(
      {
        name: "instanceCreation"
      },
      {
        id: props.instance.id,
        modloader: validInstance()?.modloader,
        title: props.instance.name,
        mcVersion: validInstance()?.mc_version,
        modloaderVersion: instanceDetails?.modloaders[0].version,
        img: props.img
      }
    );
  };

  const handleDuplicate = () => {
    if (!props.isInvalid) {
      duplicateInstanceMutation.mutate({
        instance: props.instance.id,
        new_name: props.instance.name
      });
    }
  };

  const menuItems = () => [
    {
      icon: props.isRunning ? "i-ri:stop-fill" : "i-ri:play-fill",
      label: props.isRunning ? t("instance.stop") : t("instance.action_play"),
      action: handlePlay,
      disabled: props.isLoading || isInQueue() || props.isDeleting
    },
    {
      icon: "i-ri:pencil-fill",
      label: t("instance.action_edit"),
      action: handleEdit,
      disabled: props.isLoading || isInQueue() || props.isDeleting
    },
    {
      icon: "i-ri:settings-3-fill",
      label: t("instance.action_settings"),
      action: handleSettings,
      disabled: props.isLoading || isInQueue() || props.isDeleting
    },
    ...(!props.isInvalid
      ? [
          {
            icon: "i-ri:file-copy-fill",
            label: t("instance.action_duplicate"),
            action: handleDuplicate,
            disabled: props.isLoading || isInQueue() || props.isDeleting
          }
        ]
      : []),
    {
      icon: "i-ri:folder-open-fill",
      label: t("instance.action_open_folder"),
      action: handleOpenFolder
    },
    {
      icon: "i-mingcute:file-export-fill",
      label: t("instance.export_instance"),
      action: () => {
        const instanceId = props.instance.id;
        setInstanceId(instanceId);
        setPayload({
          target: "Curseforge",
          save_path: undefined,
          self_contained_addons_bundling: false,
          filter: { entries: {} },

          instance_id: instanceId
        });
        setExportStep(0);
        setCheckedFiles([]);
        modalsContext?.openModal({
          name: "exportInstance"
        });
      },
      disabled: props.isLoading || isInQueue() || props.isDeleting
    },
    {
      id: "delete",
      icon: "i-ri:delete-bin-2-fill",
      label: t("instance.action_delete"),
      action: handleDelete,
      disabled: props.isLoading || isInQueue() || props.isDeleting
    }
  ];

  const getTranslationArgs = (translation: Translation) => {
    if ("args" in translation) {
      return translation.args;
    }
    return {};
  };

  const handlePlayClick = () => {
    if (props.isPreparing) {
      return;
    }
    if (props.isRunning) {
      killInstanceMutation.mutate(props.instance.id);
    } else {
      launchInstanceMutation.mutate(props.instance.id);
    }
  };

  const isInQueue = () => props.isPreparing && !props.isLoading;

  return (
    <Switch>
      <Match when={mergedProps.variant === "default"}>
        <ContextMenu menuItems={menuItems()}>
          <Popover
            content={
              props.failError ? (
                <div class="p-4 border-solid border-white b-1">
                  <div class="text-xl pb-4 w-full flex justify-between">
                    <div>
                      <Trans key="error" />
                    </div>
                    <div>
                      <Tooltip
                        content={
                          copiedError() ? t("copied_to_clipboard") : t("Copy")
                        }
                      >
                        <div
                          class="w-6 h-6"
                          classList={{
                            "text-darkSlate-300 hover:text-lightSlate-100 duration-100 ease-in-out i-ri:file-copy-2-fill":
                              !copiedError(),
                            "text-green-400 i-ri:checkbox-circle-fill":
                              copiedError()
                          }}
                          onClick={() => {
                            navigator.clipboard.writeText(
                              props.failError as string
                            );

                            setCopiedError(true);

                            setTimeout(() => {
                              setCopiedError(false);
                            }, 2000);
                          }}
                        />
                      </Tooltip>
                    </div>
                  </div>
                  <div>{props.failError}</div>
                </div>
              ) : undefined
            }
          >
            <div
              class="flex justify-center flex-col relative select-none group items-start"
              style={{ "pointer-events": "auto" }}
              onClick={(e) => {
                e.stopPropagation();
                if (
                  !props.isLoading &&
                  !isInQueue() &&
                  !props.isInvalid &&
                  !props.isDeleting
                ) {
                  props?.onClick?.(e);
                }
              }}
            >
              <div
                class="relative rounded-2xl overflow-hidden border-1 border-solid border-darkSlate-600"
                classList={{
                  "h-100 w-100": props.size === 5,
                  "h-70 w-70": props.size === 4,
                  "h-50 w-50": props.size === 3,
                  "h-38 w-38": props.size === 2,
                  "h-20 w-20": props.size === 1
                }}
              >
                <div
                  class="flex justify-center relative items-center rounded-2xl overflow-hidden h-full w-full bg-cover bg-center"
                  classList={{
                    grayscale: props.isLoading || isInQueue()
                  }}
                  style={{
                    "background-image": props.img
                      ? `url("${props.img}")`
                      : `url("${DefaultImg}")`
                  }}
                >
                  <Show when={props.isInvalid}>
                    <h2 class="text-sm text-center z-20">
                      <Trans key="instance.error_invalid" />
                    </h2>
                    <div class="w-full rounded-2xl z-10 absolute right-0 h-full top-0 bottom-0 left-0 bg-gradient-to-l from-black opacity-50 from-30%" />
                    <div class="z-10 absolute top-0 bottom-0 left-0 right-0 from-black opacity-50 w-full h-full rounded-2xl bg-gradient-to-t" />
                    <div class="absolute z-10 text-2xl i-ri:alert-fill text-yellow-500 top-1 right-1" />
                  </Show>
                  <Show when={props.failError}>
                    <div class="z-10 absolute top-0 bottom-0 left-0 right-0 bg-gradient-to-l from-black opacity-60 from-30% w-full h-full rounded-2xl" />
                    <div class="z-10 absolute top-0 bottom-0 left-0 right-0 bg-gradient-to-t from-black opacity-60 w-full h-full rounded-2xl" />
                    <div class="i-ri:alert-fill absolute left-0 right-0 top-0 m-auto z-10 text-4xl text-red-500 bottom-20" />
                    <div class="mt-10 z-10 text-center">
                      <div class="text-3xl font-bold">
                        <Trans key="error" />
                      </div>
                      <div class="text-sm">
                        (<Trans key="hover_for_details" />)
                      </div>
                    </div>
                  </Show>

                  <div
                    class="group flex justify-center items-center absolute rounded-full cursor-pointer ease-in-out duration-100 hidden h-12 w-12 transition-all top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 will-change-transform"
                    classList={{
                      "scale-100 bg-red-500": props.isLoading,
                      "bg-primary-500 hover:bg-primary-400 text-2xl hover:text-3xl hover:drop-shadow-2xl":
                        !props.isRunning,
                      "scale-0": !props.isRunning,
                      "bg-red-500 scale-100": props.isRunning,

                      "group-hover:scale-100 group-hover:drop-shadow-xl":
                        !props.isLoading &&
                        !isInQueue() &&
                        !props.isInvalid &&
                        !props.failError &&
                        !props.isRunning &&
                        !props.isDeleting
                    }}
                    style={{ "pointer-events": "auto" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayClick();
                    }}
                  >
                    <div
                      class="text-white"
                      classList={{
                        "i-ri:play-fill": !props.isRunning,
                        "i-ri:stop-fill text-xl": props.isRunning
                      }}
                    />
                  </div>

                  <Show
                    when={
                      props.isLoading &&
                      props.percentage !== undefined &&
                      props.percentage !== null
                    }
                  >
                    <div class="flex flex-col justify-center items-center z-20 w-full h-full gap-2 p-4">
                      <h3 class="text-center opacity-50 m-0 text-3xl">
                        {Math.round(props.percentage as number)}%
                      </h3>
                      <div class="h-10">
                        <For each={props.subTasks}>
                          {(subTask) => (
                            <div
                              class="text-center"
                              classList={{
                                "text-xs":
                                  props.subTasks && props.subTasks?.length > 1,
                                "text-md": props.subTasks?.length === 1
                              }}
                            >
                              <Trans
                                key={subTask.name.translation}
                                options={getTranslationArgs(subTask.name)}
                              />
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  </Show>
                  <Show when={isInQueue() || props.isDeleting}>
                    <div class="flex flex-col gap-2 items-center z-12">
                      <Spinner />
                      <span class="font-bold">
                        <Show when={props.isDeleting}>
                          <Trans key="instance.isDeleting" />
                        </Show>
                        <Show when={isInQueue()}>
                          <Trans key="instance.isInQueue" />
                        </Show>
                      </span>
                    </div>
                  </Show>
                  <Show when={validInstance()?.modpack}>
                    <div class="absolute flex justify-center items-center border-1 border-solid border-darkSlate-600 bg-darkSlate-900 rounded-lg p-2 top-2 right-2">
                      <img
                        class="w-4 h-4"
                        src={getModpackPlatformIcon(
                          validInstance()?.modpack?.type
                        )}
                      />
                    </div>
                  </Show>
                  <Show
                    when={props.isLoading || isInQueue() || props.isDeleting}
                  >
                    <div class="absolute top-0 bottom-0 left-0 right-0 backdrop-blur-sm z-11" />
                    <div class="z-10 absolute top-0 bottom-0 left-0 right-0 bg-gradient-to-l from-black opacity-50 from-30% w-full h-full rounded-2xl" />
                    <div class="z-10 absolute top-0 bottom-0 left-0 right-0 bg-gradient-to-t from-black opacity-50 w-full h-full rounded-2xl" />
                  </Show>
                </div>
                <Show when={props.isLoading && props.percentage !== undefined}>
                  <div
                    class="absolute left-0 bottom-0 rounded-full z-40 bg-primary-500 h-1"
                    style={{
                      width: `${props.percentage}%`
                    }}
                  />
                </Show>
              </div>
              <h4
                class="text-ellipsis whitespace-nowrap mt-2 mb-1"
                classList={{
                  "text-white":
                    !props.isLoading && !isInQueue() && !props.isDeleting,
                  "text-lightGray-900":
                    props.isLoading || isInQueue() || props.isDeleting,
                  "max-w-100": props.size === 5,
                  "max-w-70": props.size === 4,
                  "max-w-50": props.size === 3,
                  "max-w-38": props.size === 2,
                  "max-w-20": props.size === 1
                }}
              >
                <Tooltip
                  content={
                    props.instance.name.length > 20 ? props.instance.name : ""
                  }
                  placement="top"
                  class="w-full text-ellipsis overflow-hidden"
                >
                  {props.instance.name}
                </Tooltip>
              </h4>
              <Switch>
                <Match when={!props.isLoading && !props.isPreparing}>
                  <div class="flex gap-2 justify-between text-lightGray-900">
                    <span class="flex gap-1">
                      <Show when={props.modloader}>
                        <img
                          class="w-4 h-4"
                          src={getCFModloaderIcon(
                            props.modloader as CFFEModLoaderType
                          )}
                        />
                      </Show>
                      <Show when={props.size !== 1}>
                        <p class="m-0">{props.modloader?.toString()}</p>
                      </Show>
                    </span>
                    <p class="m-0">{props.version}</p>
                  </div>
                </Match>
                <Match when={props.isLoading}>
                  <p class="m-0 text-center text-lightGray-900">
                    {Math.round(props.downloaded || 0)}MB/
                    {Math.round(props.totalDownload || 0)}MB
                  </p>
                </Match>
              </Switch>
            </div>
          </Popover>
        </ContextMenu>
      </Match>
      <Match when={mergedProps.variant === "sidebar"}>
        <ContextMenu menuItems={menuItems()}>
          <div
            class="group relative group select-none flex items-center w-full box-border cursor-pointer gap-4 px-6 h-14 erelative"
            onClick={(e) => {
              if (
                !props.isLoading &&
                !isInQueue() &&
                !props.isInvalid &&
                !props.failError
              ) {
                props?.onClick?.(e);
              }
            }}
          >
            <Show when={props.isInvalid}>
              <div class="i-ri:alert-fill text-yellow-500 absolute top-1/2 -translate-y-1/2 z-10 text-2xl right-2" />
            </Show>
            <Show when={props.failError}>
              <div class="i-ri:alert-fill text-red-500 absolute top-1/2 -translate-y-1/2 right-2 z-10 text-2xl" />
            </Show>
            <div
              class="absolute ease-in-out duration-100 top-0 left-0 bottom-0 right-0 transition opacity-10"
              classList={{
                "group-hover:bg-primary-800":
                  !props.isLoading &&
                  !isInQueue() &&
                  !props.isInvalid &&
                  !props.failError &&
                  !props.isRunning
              }}
            />

            <Show when={props.selected && !props.isLoading}>
              <div class="absolute ease-in-out duration-100 opacity-10 top-0 left-0 bottom-0 right-0 transition bg-primary-800" />
              <div class="absolute left-0 top-0 bottom-0 bg-primary-500 w-1 rounded-r-md rounded-l-md" />
            </Show>
            <Show when={props.isRunning && !props.isLoading}>
              <div class="absolute ease-in-out duration-100 opacity-10 top-0 left-0 bottom-0 right-0 transition" />
              <div class="absolute right-0 top-0 bottom-0 w-1" />
            </Show>

            <Show when={props.isLoading && props.percentage !== undefined}>
              <div
                class="absolute top-0 left-0 bottom-0 opacity-10 bg-white"
                style={{
                  width: `${props.percentage}%`
                }}
              />
            </Show>
            <div class="relative">
              <div
                class="bg-cover bg-center h-10 rounded-lg w-10 min-w-10 max-w-10"
                style={{
                  "background-image": props.img
                    ? `url("${props.img as string}")`
                    : `url("${DefaultImg}")`
                }}
                classList={{
                  "group-hover:opacity-50 group-hover:blur-[1.5px]  transition ease-in-out duration-150":
                    !props.isLoading && !props.isRunning && !isInQueue(),
                  "opacity-50 blur-[1.5px]": props.isRunning,
                  grayscale: props.isLoading || isInQueue() || props.isDeleting
                }}
              />
              <div
                class="rounded-full absolute flex justify-center items-center cursor-pointer duration-100 will-change-transform top-2 transition-transform z-20 left-2 h-7 w-7"
                classList={{
                  "scale-0": !props.isRunning,
                  "scale-100": props.isRunning,

                  "group-hover:scale-100":
                    !props.isLoading &&
                    !isInQueue() &&
                    !props.isInvalid &&
                    !props.failError &&
                    !props.isRunning
                }}
              >
                <div
                  class="text-white"
                  classList={{
                    "i-ri:play-fill text-2xl  ": !props.isRunning,
                    "i-ri:stop-fill text-lg  ": props.isRunning
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayClick();
                  }}
                />
              </div>
              <Show when={props.isLoading || isInQueue()}>
                <div class="absolute top-3 left-[11px]">
                  <Spinner />
                </div>
              </Show>
            </div>

            <div class="flex flex-col truncate">
              <div
                class="m-0 text-ellipsis text-ellipsis overflow-hidden max-w-38 text-sm max-h-9"
                // classList={{
                //   "text-darkSlate-50": mergedProps.isLoading,
                //   "text-white": !mergedProps.isLoading
                // }}
              >
                {props.instance.name}
              </div>
              <div class="flex text-darkSlate-50">
                <Show when={!props.isLoading}>
                  <span class="flex gap-2 items-center">
                    <Show when={props.modloader}>
                      <img
                        class="w-4 h-4"
                        src={getCFModloaderIcon(
                          props.modloader as CFFEModLoaderType
                        )}
                      />
                    </Show>
                    <p class="m-0 text-sm">{props.version}</p>
                  </span>
                </Show>

                <Show when={props.isLoading}>
                  <div class="m-0 flex gap-1">
                    <div class="text-green-500 i-clarity:download-line" />
                    <span class="font-bold text-sm">
                      {Math.round(props.percentage as number)}%
                    </span>
                    <span class="text-sm">
                      {Math.round(props.downloaded || 0)}MB/
                      {Math.round(props.totalDownload || 0)}MB
                    </span>
                  </div>
                </Show>
              </div>
            </div>
          </div>
        </ContextMenu>
      </Match>
      <Match when={mergedProps.variant === "sidebar-small"}>
        <Tooltip content={props.instance.name} placement="right">
          <div
            onClick={(e) => {
              if (
                !props.isLoading &&
                !isInQueue() &&
                !props.isInvalid &&
                !props.failError
              ) {
                props?.onClick?.(e);
              }
            }}
            class="group h-14 px-3 flex justify-center items-center relative cursor-pointer relative"
          >
            <div class="absolute ease-in-out duration-100 opacity-10 top-0 left-0 bottom-0 right-0 transition hover:bg-primary-500" />

            <Show when={props.selected && !props.isLoading}>
              <div class="absolute ease-in-out duration-100 opacity-10 top-0 left-0 bottom-0 right-0 transition bg-primary-500" />
              <div class="absolute left-0 top-0 bottom-0 bg-primary-500 w-1 rounded-r-md rounded-l-md" />
            </Show>
            <Show when={props.isRunning && !props.isLoading}>
              <div class="absolute ease-in-out duration-100 opacity-10 top-0 left-0 bottom-0 right-0 transition" />
              <div class="absolute right-0 top-0 bottom-0 w-1" />
            </Show>
            <div
              class="relative group h-10 w-10 rounded-lg flex justify-center items-center bg-cover bg-center"
              style={{
                "background-image": props.img
                  ? `url("${props.img as string}")`
                  : `url("${DefaultImg}")`
              }}
              classList={{
                grayscale: props.isLoading || isInQueue()
              }}
            >
              <Show when={props.isInvalid}>
                <div class="i-ri:alert-fill text-yellow-500 absolute top-1/2 -translate-y-1/2 right-2 z-10 text-2xl" />
              </Show>
              <Show when={props.failError}>
                <div class="i-ri:alert-fill text-red-500 absolute top-1/2 -translate-y-1/2 right-1/2 z-10 text-2xl" />
              </Show>

              <div
                class="h-7 w-7 rounded-full flex justify-center items-center cursor-pointer transition-transform duration-100 will-change-transform right-5"
                classList={{
                  "bg-primary-500": !props.isRunning,
                  "scale-0": !props.isRunning,
                  "bg-red-500 scale-100": props.isRunning,
                  "group-hover:scale-100":
                    !props.isLoading &&
                    !isInQueue() &&
                    !props.isInvalid &&
                    !props.failError &&
                    !props.isRunning
                }}
              >
                <div
                  class="text-white transition-all duration-100 ease-in-out text-lg"
                  classList={{
                    "i-ri:play-fill": !props.isRunning,
                    "i-ri:stop-fill": props.isRunning
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayClick();
                  }}
                />
              </div>
            </div>
          </div>
        </Tooltip>
      </Match>
    </Switch>
  );
};

export default Tile;
