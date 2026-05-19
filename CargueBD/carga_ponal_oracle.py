import argparse

from loader_service import default_path_for, run_load


def main():
    parser = argparse.ArgumentParser(description="Carga PONAL hacia Oracle.")
    parser.add_argument("--archivo", default=str(default_path_for("ponal")), help="Ruta al archivo Excel PONAL")
    parser.add_argument("--no-etl", action="store_true", help="Carga staging sin ejecutar PRC_CARGA_PONAL")
    args = parser.parse_args()
    run_load("ponal", args.archivo, execute_etl=not args.no_etl)


if __name__ == "__main__":
    main()
