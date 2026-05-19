import argparse

from loader_service import default_path_for, run_load


def main():
    parser = argparse.ArgumentParser(description="Carga Aurora 1.0 hacia Oracle.")
    parser.add_argument("--archivo", default=str(default_path_for("aurora_10")), help="Ruta al archivo Excel Aurora 1.0")
    parser.add_argument("--no-etl", action="store_true", help="Carga staging sin ejecutar PRC_CARGA_AURORA10")
    args = parser.parse_args()
    run_load("aurora_10", args.archivo, execute_etl=not args.no_etl)


if __name__ == "__main__":
    main()
