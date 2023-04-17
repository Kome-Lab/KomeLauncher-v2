import Tile from "@/components/Instance/Tile";
import { Carousel, News } from "@gd/ui";
import { useRouteData } from "@solidjs/router";
import { For, Show, createEffect, createSignal } from "solid-js";
import { useTransContext } from "@gd/i18n";
import { ModloaderType } from "@/utils/sidebar";
import { createStore } from "solid-js/store";
import { useGDNavigate } from "@/managers/NavigationManager";
import fetchData from "../Library/library.data";
import { Instance } from "@gd/core_module/bindings";

type MockInstance = {
  title: string;
  modloader: ModloaderType;
  mcVersion: string;
  id: string;
};

const mockCarousel: MockInstance[] = [
  {
    title: "Minecraft forge 1",
    modloader: "forge",
    mcVersion: "1.19.2",
    id: "ABDFEAD",
  },
  {
    title: "Minecraft forge 2",
    modloader: "forge",
    mcVersion: "1.19.2",
    id: "DDAEDF",
  },
  {
    title: "Minecraft forge 3",
    modloader: "forge",
    mcVersion: "1.19.2",
    id: "HDHEJA",
  },
  {
    title: "Minecraft forge 4",
    modloader: "forge",
    mcVersion: "1.19.2",
    id: "HUSER",
  },
  {
    title: "Minecraft forge 5",
    modloader: "forge",
    mcVersion: "1.19.2",
    id: "PDODK",
  },
  {
    title: "Minecraft forge 6",
    modloader: "forge",
    mcVersion: "1.19.2",
    id: "AKFBI",
  },
  {
    title: "Minecraft forge 7",
    modloader: "forge",
    mcVersion: "1.19.2",
    id: "AHUUIO",
  },
  {
    title: "Minecraft forge 8",
    modloader: "forge",
    mcVersion: "1.19.2",
    id: "HFHDJ",
  },
];

const Home = () => {
  const navigate = useGDNavigate();
  const [t] = useTransContext();
  const [news, setNews] = createStore([]);
  const [instances, setInstances] = createStore<Instance[]>([]);
  const [isNewsVisible, setIsNewVisible] = createSignal(false);
  const routeData: ReturnType<typeof fetchData> = useRouteData();

  createEffect(() => {
    if (routeData.instances.data) {
      routeData.instances.data.forEach((instance) => {
        setInstances((prev) => [...prev, instance]);
      });
    }
  });

  createEffect(() => {
    routeData.news.then((newss) => {
      setNews(newss);
    });
  });

  createEffect(() => {
    setIsNewVisible(!!routeData.settings.data?.showNews);
  });

  return (
    <div class="p-6">
      <div>
        <Show when={news.length > 0 && isNewsVisible()}>
          <News
            slides={news}
            onClick={(news) => {
              window.openExternalLink(news.url || "");
            }}
          />
        </Show>
        {/* <div class="mt-4">
          <Carousel title={t("recent_played")}>
            <For each={mockCarousel}>
              {(instance) => (
                <div id={instance.id}>
                  <Tile
                    onClick={() => navigate(`/library/${instance.id}`)}
                    title={instance.title}
                    modloader={instance.modloader}
                    version={instance.mcVersion}
                  />
                </div>
              )}
            </For>
          </Carousel>
        </div> */}
        <Show when={instances.length > 0}>
          <div class="mt-4">
            <Carousel title={t("your_instances")}>
              <For each={instances}>
                {(instance) => (
                  <Tile
                    onClick={() => navigate(`/library/${instance.id}`)}
                    title={instance.name}
                    modloader={instance.modloader as ModloaderType}
                    version={instance.mc_version}
                  />
                )}
              </For>
            </Carousel>
          </div>
        </Show>
        {/* <div class="mt-4">
          <Carousel title={t("popular_modpacks")}>
            <For each={mockCarousel}>
              {(instance) => (
                <div id={instance.id}>
                  <Tile
                    onClick={() => navigate(`/library/${instance.id}`)}
                    title={instance.title}
                    modloader={instance.modloader}
                    version={instance.mcVersion}
                  />
                </div>
              )}
            </For>
          </Carousel>
        </div> */}
      </div>
    </div>
  );
};

export default Home;
