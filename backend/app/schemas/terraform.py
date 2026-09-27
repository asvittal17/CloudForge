from pydantic import BaseModel


class TerraformStageRequest(BaseModel):
    main_tf: str
    variables_tf: str
    outputs_tf: str


class TerraformStageResponse(BaseModel):
    id: int
    project_id: int
    status: str
    message: str